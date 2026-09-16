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
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import nodemailer, { type Transporter } from 'nodemailer';
import { applicationDefault, cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;
const APP_URL = (process.env.APP_URL || '').replace(/\/+$/, '');
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MANAGEMENT_ROLES = new Set(['ADMIN', 'MANAGER']);
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

async function requireVerifiedUser(req: Request, res: Response, next: NextFunction) {
  if (!admin) return res.status(503).json({ error: 'Email is not configured on this server.' });
  const match = /^Bearer\s+(.+)$/i.exec(req.get('authorization') || '');
  if (!match) return res.status(401).json({ error: 'Sign in required.' });
  try {
    const user = await getAuth(admin.app).verifyIdToken(match[1], true);
    if (!user.email || user.email_verified !== true) {
      return res.status(403).json({ error: 'Verify your email address first.' });
    }
    res.locals.user = user;
    return next();
  } catch {
    return res.status(401).json({ error: 'Your session has expired. Sign in again.' });
  }
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

  app.use('/api', express.json({ limit: '10kb' }));

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
