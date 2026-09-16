/**
 * Optional API server for transactional email. The web app is fully functional on static
 * hosting without it; when deployed (e.g. Cloud Run), it adds:
 *
 *   POST /api/send-onboarding-email  invitation email for a PENDING invite (company ADMIN/MANAGER only)
 *   POST /api/test-email             SMTP self-test, sent to the caller (platform admins only)
 *   GET  /api/health                 liveness probe
 *
 * Every authenticated endpoint verifies the caller's Firebase ID token with the Admin SDK and
 * re-checks authorisation against Firestore. Passwords are never sent by email.
 */

import express, { type NextFunction, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import nodemailer, { type Transporter } from 'nodemailer';
import { applicationDefault, cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { FieldValue, getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { BILLING_PLAN_IDS, nextExpiry, normalizeBillingConfig, paymentReference } from './src/lib/billing';
import type { BillingPlanId } from './src/types';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;
const APP_URL = (process.env.APP_URL || '').replace(/\/+$/, '');
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MANAGEMENT_ROLES = new Set(['ADMIN', 'MANAGER']);
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || '';
const PAYSTACK_API = 'https://api.paystack.co';

/** express.json keeps the raw bytes so the Paystack webhook signature can be checked. */
interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}
const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  ACCOUNT: 'Account / Finance',
  AUDITOR: 'Auditor',
  STORE_KEEPER: 'Store Keeper',
  STAFF: 'Staff',
};

// ---------------------------------------------------------------------------
// Firebase Admin
// ---------------------------------------------------------------------------

function initAdmin(): { app: App; db: Firestore } | null {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  const databaseId = process.env.FIREBASE_FIRESTORE_DATABASE_ID || process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || '(default)';
  if (!projectId) {
    console.warn('[api] FIREBASE_PROJECT_ID is not set; authenticated endpoints are disabled.');
    return null;
  }
  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    const app = getApps()[0] ?? initializeApp({
      credential: serviceAccount ? cert(JSON.parse(serviceAccount)) : applicationDefault(),
      projectId,
    });
    const db = databaseId === '(default)' ? getFirestore(app) : getFirestore(app, databaseId);
    return { app, db };
  } catch (error) {
    console.error('[api] Firebase Admin could not be initialised; authenticated endpoints are disabled:', error instanceof Error ? error.message : error);
    return null;
  }
}

const admin = initAdmin();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Simple fixed-window limiter per client IP and route. Suitable for a single instance. */
function rateLimit(windowMs: number, max: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    if (hits.size > 5_000) {
      for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
    }
    const key = `${req.ip}|${req.path}`;
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    return next();
  };
}

let transporter: Transporter | null = null;

function mailer(): Transporter | null {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      // Certificate verification stays on.
      tls: { minVersion: 'TLSv1.2' },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }
  return transporter;
}

const fromAddress = () => process.env.SMTP_FROM || `"Commodity Control System" <${process.env.SMTP_USER}>`;

function smtpErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('535') || /invalid login/i.test(message)) {
    return 'SMTP login failed. Check SMTP_USER / SMTP_PASS (Gmail requires an App Password).';
  }
  return 'The email could not be sent. Check the server logs for details.';
}

async function authenticate(req: Request, res: Response): Promise<DecodedIdToken | null> {
  const match = /^Bearer\s+(.+)$/i.exec(req.get('authorization') || '');
  if (!match) {
    res.status(401).json({ error: 'Sign in required.' });
    return null;
  }
  try {
    return await getAuth(admin!.app).verifyIdToken(match[1], true);
  } catch {
    res.status(401).json({ error: 'Your session has expired. Sign in again.' });
    return null;
  }
}

/** Signed in with a real account. Used where a verified email is not required, such as paying. */
async function requireUser(req: Request, res: Response, next: NextFunction) {
  if (!admin) return res.status(503).json({ error: 'This server is not configured.' });
  const user = await authenticate(req, res);
  if (!user) return undefined;
  if (!user.email) return res.status(403).json({ error: 'Your account has no email address.' });
  res.locals.user = user;
  return next();
}

/** Signed in with a verified email. Required before we will send mail on someone's behalf. */
async function requireVerifiedUser(req: Request, res: Response, next: NextFunction) {
  if (!admin) return res.status(503).json({ error: 'Email is not configured on this server.' });
  const user = await authenticate(req, res);
  if (!user) return undefined;
  if (!user.email || user.email_verified !== true) {
    return res.status(403).json({ error: 'Verify your email address first.' });
  }
  res.locals.user = user;
  return next();
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

async function main() {
  const app = express();
  app.disable('x-powered-by');
  // Cloud Run / load balancers sit in front of the app; needed for per-IP rate limiting.
  app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (isProduction) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });

  app.use('/api', express.json({
    limit: '10kb',
    verify: (req, _res, buf) => {
      (req as RawBodyRequest).rawBody = buf;
    },
  }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const recentlyEmailed = new Map<string, number>();

  app.post('/api/send-onboarding-email', rateLimit(15 * 60_000, 30), requireVerifiedUser, async (req, res, next) => {
    try {
      const caller = res.locals.user as DecodedIdToken;
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const companyId = typeof req.body?.companyId === 'string' ? req.body.companyId.trim() : '';
      if (!EMAIL_RE.test(email) || email.length > 254 || !companyId || companyId.length > 200 || companyId.includes('/')) {
        return res.status(400).json({ error: 'Invalid request.' });
      }

      const db = admin!.db;
      const inviteId = `${companyId}__${email}`;
      const [profileSnap, companySnap, inviteSnap] = await Promise.all([
        db.doc(`users/${caller.uid}`).get(),
        db.doc(`companies/${companyId}`).get(),
        db.doc(`invites/${inviteId}`).get(),
      ]);

      const profile = profileSnap.data();
      const company = companySnap.data();
      const callerAllowed = !!profile
        && profile.companyId === companyId
        && MANAGEMENT_ROLES.has(profile.role)
        && (profile.status ?? 'ACTIVE') === 'ACTIVE'
        && profile.suspended !== true;
      const companyOperational = !!company
        && company.isApproved === true
        && (company.status ?? 'ACTIVE') === 'ACTIVE'
        && company.isDeleted !== true;
      if (!callerAllowed || !companyOperational) {
        return res.status(403).json({ error: 'You are not allowed to invite people to this company.' });
      }

      const invite = inviteSnap.data();
      if (!invite || invite.status !== 'PENDING') {
        return res.status(404).json({ error: 'No pending invitation exists for this email address.' });
      }

      const last = recentlyEmailed.get(inviteId) ?? 0;
      if (Date.now() - last < 10 * 60_000) return res.json({ sent: false, reason: 'recently_sent' });

      const transport = mailer();
      if (!transport) return res.json({ sent: false, reason: 'smtp_not_configured' });

      // Content comes from Firestore, not from the request body.
      let name = '';
      if (typeof invite.staffId === 'string' && invite.staffId && !invite.staffId.includes('/')) {
        const staff = await db.doc(`staff/${invite.staffId}`).get();
        if (staff.exists && staff.get('companyId') === companyId) name = String(staff.get('name') ?? '');
      }
      const companyName = escapeHtml(company!.name || 'your company');
      const roleLabel = escapeHtml(ROLE_LABELS[invite.role] ?? invite.role);
      const link = APP_URL ? `<a href="${escapeHtml(APP_URL)}" style="color:#4f46e5">${escapeHtml(APP_URL)}</a>` : 'the Commodity Control System';

      await transport.sendMail({
        from: fromAddress(),
        to: email,
        subject: `You're invited to ${company!.name || 'the Commodity Control System'}`,
        text: [
          `Hello ${name || 'there'},`,
          '',
          `${caller.email} has invited you to join ${company!.name || 'a company'} on the Commodity Control System as ${ROLE_LABELS[invite.role] ?? invite.role}.`,
          '',
          '1. Set your password using the separate password-setup email, or sign in with Google using this email address.',
          `2. Sign in${APP_URL ? ` at ${APP_URL}` : ''} and accept the invitation.`,
          '',
          'We never send passwords by email. If you did not expect this invitation, you can ignore this message.',
        ].join('\n'),
        html: `
          <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;color:#1e293b">
            <h2 style="color:#4f46e5;margin-top:0">You're invited to ${companyName}</h2>
            <p>Hello ${escapeHtml(name || 'there')},</p>
            <p>${escapeHtml(caller.email)} has invited you to join <strong>${companyName}</strong> on the Commodity Control System as <strong>${roleLabel}</strong>.</p>
            <ol>
              <li>Set your password using the separate password-setup email, or sign in with Google using this email address.</li>
              <li>Sign in at ${link} and accept the invitation.</li>
            </ol>
            <p style="font-size:12px;color:#64748b">We never send passwords by email. If you did not expect this invitation, you can ignore this message.</p>
          </div>`,
      });

      recentlyEmailed.set(inviteId, Date.now());
      console.info(`[api] invitation email sent (company=${companyId}, by=${caller.uid})`);
      return res.json({ sent: true });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/api/test-email', rateLimit(15 * 60_000, 5), requireVerifiedUser, async (_req, res) => {
    const caller = res.locals.user as DecodedIdToken;
    try {
      const isPlatformAdmin = (await admin!.db.doc(`platform_admins/${caller.uid}`).get()).exists;
      if (!isPlatformAdmin) return res.status(403).json({ error: 'Only platform administrators can run this test.' });

      const transport = mailer();
      if (!transport) return res.status(503).json({ error: 'SMTP_USER and SMTP_PASS are not set on the server.' });

      await transport.verify();
      await transport.sendMail({
        from: fromAddress(),
        to: caller.email,
        subject: 'Commodity Control System - SMTP test',
        text: 'This is a test email from the Commodity Control System. Your SMTP settings work.',
        html: '<p>This is a test email from the Commodity Control System.</p><p>Your SMTP settings work.</p>',
      });
      return res.json({ sent: true });
    } catch (error) {
      console.error('[api] SMTP test failed:', error instanceof Error ? error.message : error);
      return res.status(502).json({ error: smtpErrorMessage(error) });
    }
  });

  // -------------------------------------------------------------------------
  // Billing (Paystack, manual renewal)
  //
  // A payment is only ever applied after the transaction is verified directly with Paystack,
  // so neither the browser nor a forged webhook can extend a subscription.
  // -------------------------------------------------------------------------

  const paystack = async (path: string, init?: RequestInit) => {
    const response = await fetch(`${PAYSTACK_API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    return (await response.json()) as { status?: boolean; message?: string; data?: Record<string, unknown> };
  };

  /** Verifies a reference with Paystack and, if it is paid, extends the company. Idempotent. */
  async function applyPayment(reference: string): Promise<'applied' | 'already_applied' | 'not_paid' | 'unknown'> {
    const db = admin!.db;
    const paymentRef = db.doc(`billing_payments/${reference}`);
    const payment = (await paymentRef.get()).data();
    if (!payment) return 'unknown';
    if (payment.status === 'PAID') return 'already_applied';

    const verified = await paystack(`/transaction/verify/${encodeURIComponent(reference)}`);
    const data = verified.data ?? {};
    if (!verified.status || data.status !== 'success') {
      if (data.status === 'failed' || data.status === 'abandoned') {
        await paymentRef.update({ status: data.status === 'failed' ? 'FAILED' : 'ABANDONED', failureReason: String(data.gateway_response ?? '') });
      }
      return 'not_paid';
    }
    // Never trust the amount reported by the caller; compare with what we recorded.
    if (Number(data.amount) < Number(payment.amountKobo)) {
      await paymentRef.update({ status: 'FAILED', failureReason: 'Amount paid is less than the plan price.' });
      return 'not_paid';
    }

    const months = Number(payment.months) || 1;
    const companyRef = db.doc(`companies/${payment.companyId}`);
    const expiresAt = await db.runTransaction(async tx => {
      const [companySnap, paymentSnap] = await Promise.all([tx.get(companyRef), tx.get(paymentRef)]);
      if (paymentSnap.get('status') === 'PAID') return paymentSnap.get('expiresAt') as Timestamp;
      const current = companySnap.get('subscriptionExpiresAt') as Timestamp | undefined;
      const next = Timestamp.fromDate(nextExpiry(current ? current.toDate() : null, months));
      tx.update(companyRef, {
        subscriptionExpiresAt: next,
        subscriptionPlan: payment.plan,
        subscriptionMonths: months,
        updatedAt: new Date().toISOString(),
      });
      tx.update(paymentRef, {
        status: 'PAID',
        paidAt: FieldValue.serverTimestamp(),
        expiresAt: next,
        paystackId: Number(data.id) || null,
        channel: String(data.channel ?? ''),
      });
      return next;
    });
    console.info(`[api] subscription extended: company=${payment.companyId} plan=${payment.plan} until=${expiresAt.toDate().toISOString()}`);
    return 'applied';
  }

  app.post('/api/billing/initialize', rateLimit(15 * 60_000, 20), requireUser, async (req, res, next) => {
    try {
      if (!PAYSTACK_SECRET) return res.status(503).json({ error: 'Payments are not configured on this server.' });
      const caller = res.locals.user as DecodedIdToken;
      const plan = String(req.body?.plan ?? '') as BillingPlanId;
      if (!BILLING_PLAN_IDS.includes(plan)) return res.status(400).json({ error: 'Choose a valid plan.' });

      const db = admin!.db;
      const profile = (await db.doc(`users/${caller.uid}`).get()).data();
      if (!profile || profile.role !== 'ADMIN' || (profile.status ?? 'ACTIVE') !== 'ACTIVE' || profile.suspended === true) {
        return res.status(403).json({ error: 'Only a company admin can pay for a subscription.' });
      }
      const companyId = String(profile.companyId || '');
      const company = (await db.doc(`companies/${companyId}`).get()).data();
      if (!company || company.isApproved !== true || company.isDeleted === true) {
        return res.status(403).json({ error: 'This company is not active.' });
      }

      const config = normalizeBillingConfig((await db.doc('platform_config/billing').get()).data());
      const price = config.plans[plan];
      if (!price || price.amountKobo <= 0) {
        return res.status(409).json({ error: 'That plan has no price yet. Please contact the administrator.' });
      }

      const reference = paymentReference(companyId);
      const init = await paystack('/transaction/initialize', {
        method: 'POST',
        body: JSON.stringify({
          email: caller.email,
          amount: price.amountKobo,
          currency: config.currency,
          reference,
          callback_url: APP_URL ? `${APP_URL}/?billing=${encodeURIComponent(reference)}` : undefined,
          metadata: { companyId, plan, months: price.months, uid: caller.uid },
        }),
      });
      if (!init.status || !init.data?.authorization_url) {
        console.error('[api] paystack initialize failed:', init.message);
        return res.status(502).json({ error: 'Could not start the payment. Please try again.' });
      }

      await db.doc(`billing_payments/${reference}`).set({
        id: reference, companyId, companyName: company.name ?? '', plan, months: price.months,
        amountKobo: price.amountKobo, currency: config.currency, status: 'PENDING',
        initiatedByUid: caller.uid, initiatedByEmail: caller.email, createdAt: FieldValue.serverTimestamp(),
      });
      return res.json({ authorizationUrl: init.data.authorization_url, reference });
    } catch (error) {
      return next(error);
    }
  });

  // Paystack calls this; it carries no Firebase token, so the HMAC signature is the only proof.
  app.post('/api/billing/webhook', async (req, res) => {
    if (!admin || !PAYSTACK_SECRET) return res.status(503).end();
    const raw = (req as RawBodyRequest).rawBody;
    const signature = req.get('x-paystack-signature') || '';
    if (!raw || !signature) return res.status(400).end();
    const expected = crypto.createHmac('sha512', PAYSTACK_SECRET).update(raw).digest('hex');
    const provided = Buffer.from(signature, 'utf8');
    const digest = Buffer.from(expected, 'utf8');
    if (provided.length !== digest.length || !crypto.timingSafeEqual(provided, digest)) {
      return res.status(401).end();
    }
    // Acknowledge immediately; Paystack retries on anything slow or non-200.
    res.status(200).end();
    const event = req.body as { event?: string; data?: { reference?: string } };
    if (event?.event !== 'charge.success' || !event.data?.reference) return undefined;
    try {
      await applyPayment(String(event.data.reference));
    } catch (error) {
      console.error('[api] billing webhook could not be applied:', error instanceof Error ? error.message : error);
    }
    return undefined;
  });

  // The browser polls this after returning from Paystack. It also applies the payment when the
  // webhook has not arrived yet, so a customer is never left waiting on a missed callback.
  app.get('/api/billing/status/:reference', rateLimit(15 * 60_000, 60), requireUser, async (req, res, next) => {
    try {
      const caller = res.locals.user as DecodedIdToken;
      const reference = String(req.params.reference || '');
      const db = admin!.db;
      const paymentSnap = await db.doc(`billing_payments/${reference}`).get();
      if (!paymentSnap.exists) return res.status(404).json({ error: 'Unknown payment.' });
      const profile = (await db.doc(`users/${caller.uid}`).get()).data();
      if (!profile || profile.companyId !== paymentSnap.get('companyId') || profile.role !== 'ADMIN') {
        return res.status(403).json({ error: 'You cannot view this payment.' });
      }
      if (paymentSnap.get('status') === 'PENDING' && PAYSTACK_SECRET) await applyPayment(reference);
      const fresh = await db.doc(`billing_payments/${reference}`).get();
      const expiresAt = fresh.get('expiresAt') as Timestamp | undefined;
      return res.json({ status: fresh.get('status'), plan: fresh.get('plan'), expiresAt: expiresAt ? expiresAt.toDate().toISOString() : null });
    } catch (error) {
      return next(error);
    }
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found.' });
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) return;
    // Client errors raised by middleware (e.g. body-parser: 400 malformed JSON, 413 too large).
    const status = (error as { status?: unknown })?.status;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      res.status(status).json({ error: status === 413 ? 'Request body too large.' : 'Invalid request.' });
      return;
    }
    console.error('[api] unexpected error:', error instanceof Error ? error.stack || error.message : error);
    res.status(500).json({ error: 'Internal server error.' });
  });

  if (!isProduction) {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(path.join(distPath, 'index.html'))) {
      app.use('/assets', express.static(path.join(distPath, 'assets'), { index: false, immutable: true, maxAge: '1y' }));
      app.use(express.static(distPath, { index: false, maxAge: '1h' }));
      app.get('*', (_req, res) => {
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      // Typical Cloud Run setup: Firebase Hosting serves the web app and rewrites /api/** here.
      console.info('[api] dist/ not found; serving the API only.');
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.info(`[api] listening on http://localhost:${PORT} (${isProduction ? 'production' : 'development'})`);
  });
}

main().catch(error => {
  console.error('[api] failed to start:', error);
  process.exit(1);
});
