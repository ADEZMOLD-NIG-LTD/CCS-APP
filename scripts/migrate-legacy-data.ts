/**
 * One-off migration of data created before the security hardening. Dry run by default.
 *
 *   npm run admin:migrate                      # report only
 *   npm run admin:migrate -- --apply           # write the fixes
 *   npm run admin:migrate -- --company <id>    # restrict to one company
 *
 * Automatic fixes
 *   - companies: set ownerUid from a verified owner email; set status (ACTIVE if approved, else PENDING)
 *   - users: map legacy roles (SUPER_ADMIN, GUEST, unknown) to STAFF; map legacy `suspended` to status
 *   - users: mirror DISMISSED / SUSPENDED staff records onto the linked login (offboarding)
 *   - staff: create a PENDING invite for staff with an email but no linked login
 *
 * Reported for manual review (never changed automatically)
 *   - profiles whose document id is not the Firebase uid, or whose email differs from Auth
 *   - ADMIN profiles that are not the company owner (possible self-promotion under the old rules)
 *   - profiles pointing at a missing company
 *   - accounts still flagged mustChangePassword (likely created with the old default password)
 *   - legacy SUPER_ADMIN profiles (grant real access with admin:grant-super-admin if appropriate)
 */

import type { DocumentData, DocumentReference, Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';
import { initAdmin } from './lib/admin';

const ROLES = new Set(['ADMIN', 'MANAGER', 'ACCOUNT', 'AUDITOR', 'STORE_KEEPER', 'STAFF']);
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const ONLY_COMPANY = args.includes('--company') ? args[args.indexOf('--company') + 1] : undefined;

type Update = { ref: DocumentReference; data: DocumentData; merge?: boolean; note: string };

const updates: Update[] = [];
const findings: string[] = [];

const normalizeEmail = (value: unknown) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

async function authUserByEmail(auth: Auth, email: string) {
  try {
    return await auth.getUserByEmail(email);
  } catch {
    return null;
  }
}

async function authUserByUid(auth: Auth, uid: string) {
  try {
    return await auth.getUser(uid);
  } catch {
    return null;
  }
}

async function commit(db: Firestore) {
  for (let i = 0; i < updates.length; i += 400) {
    const batch = db.batch();
    updates.slice(i, i + 400).forEach(u => batch.set(u.ref, u.data, { merge: u.merge ?? true }));
    await batch.commit();
  }
}

async function main() {
  const { auth, db, projectId } = initAdmin();
  const now = new Date().toISOString();
  console.log(`Project ${projectId}${ONLY_COMPANY ? `, company ${ONLY_COMPANY}` : ''} — ${APPLY ? 'APPLYING CHANGES' : 'dry run'}\n`);

  // ---------------------------------------------------------------- companies
  const companySnap = ONLY_COMPANY ? [await db.doc(`companies/${ONLY_COMPANY}`).get()].filter(s => s.exists) : (await db.collection('companies').get()).docs;
  const companies = new Map<string, DocumentData>();
  for (const snap of companySnap) {
    const c = snap.data()!;
    companies.set(snap.id, c);
    const patch: DocumentData = {};
    if (!c.ownerUid && c.ownerEmail) {
      const owner = await authUserByEmail(auth, normalizeEmail(c.ownerEmail));
      if (owner?.emailVerified) {
        patch.ownerUid = owner.uid;
        c.ownerUid = owner.uid;
      } else {
        findings.push(`company ${snap.id} "${c.name}": owner ${c.ownerEmail} ${owner ? 'has not verified their email' : 'has no account'}; ownerUid not set`);
      }
    }
    if (!c.status) patch.status = c.isDeleted ? 'DELETED' : c.isApproved === true ? 'ACTIVE' : 'PENDING';
    if (Object.keys(patch).length) updates.push({ ref: snap.ref, data: { ...patch, updatedAt: now }, note: `company ${snap.id}: ${JSON.stringify(patch)}` });
  }
  if (ONLY_COMPANY && companies.size === 0) throw new Error(`Company ${ONLY_COMPANY} not found.`);

  // ---------------------------------------------------------------- users
  const userDocs = ONLY_COMPANY
    ? (await db.collection('users').where('companyId', '==', ONLY_COMPANY).get()).docs
    : (await db.collection('users').get()).docs;
  const profilesByEmail = new Map<string, { id: string; data: DocumentData }[]>();

  for (const snap of userDocs) {
    const u = snap.data();
    const email = normalizeEmail(u.email);
    if (email) profilesByEmail.set(email, [...(profilesByEmail.get(email) ?? []), { id: snap.id, data: u }]);

    const authUser = await authUserByUid(auth, snap.id);
    if (!authUser) findings.push(`user ${snap.id} (${email || 'no email'}): document id is not a Firebase Auth uid — the rules key profiles by uid`);
    else if (normalizeEmail(authUser.email) !== email) findings.push(`user ${snap.id}: profile email ${email} differs from Auth email ${authUser.email}`);

    const patch: DocumentData = {};
    if (!ROLES.has(u.role)) {
      if (u.role === 'SUPER_ADMIN') findings.push(`user ${snap.id} (${email}): legacy SUPER_ADMIN profile role removed; grant platform access explicitly if intended`);
      patch.role = 'STAFF';
    }
    if (u.suspended === true && !u.status) patch.status = 'SUSPENDED';

    const company = u.companyId ? companies.get(u.companyId) ?? (ONLY_COMPANY ? undefined : null) : undefined;
    if (u.companyId && company === null) {
      const exists = (await db.doc(`companies/${u.companyId}`).get()).exists;
      if (!exists) findings.push(`user ${snap.id} (${email}): companyId ${u.companyId} does not exist`);
    }
    if ((patch.role ?? u.role) === 'ADMIN' && company && company.ownerUid !== snap.id) {
      findings.push(`user ${snap.id} (${email}): ADMIN of ${u.companyId} but not its owner — confirm this promotion was legitimate`);
    }
    if (u.mustChangePassword === true) {
      findings.push(`user ${snap.id} (${email}): still flagged mustChangePassword — likely created with the old default password; send a password reset`);
      if (!u.mustChangePasswordSetAt) patch.mustChangePasswordSetAt = new Date();
    }

    if (Object.keys(patch).length) updates.push({ ref: snap.ref, data: { ...patch, updatedAt: now }, note: `user ${snap.id}: ${JSON.stringify(patch)}` });
  }

  // ---------------------------------------------------------------- staff
  const staffDocs = ONLY_COMPANY
    ? (await db.collection('staff').where('companyId', '==', ONLY_COMPANY).get()).docs
    : (await db.collection('staff').get()).docs;

  for (const snap of staffDocs) {
    const s = snap.data();
    const email = normalizeEmail(s.email);
    if (!email || !s.companyId) continue;
    const company = companies.get(s.companyId) ?? (await db.doc(`companies/${s.companyId}`).get()).data();
    if (!company) continue;

    const linked = (profilesByEmail.get(email) ?? []).find(p => p.data.companyId === s.companyId || p.id === s.uid);
    const offboarded = s.isDeleted === true || s.status === 'DISMISSED' || s.status === 'SUSPENDED' || s.status === 'INACTIVE';

    if (linked) {
      if (offboarded && (linked.data.status ?? 'ACTIVE') === 'ACTIVE' && linked.data.companyId === s.companyId) {
        const status = s.status === 'SUSPENDED' ? 'SUSPENDED' : 'DISMISSED';
        updates.push({ ref: db.doc(`users/${linked.id}`), data: { status, updatedAt: now }, note: `user ${linked.id} (${email}): access revoked to match staff status ${s.status ?? 'deleted'}` });
      }
      continue;
    }
    if (offboarded) continue;

    const inviteId = `${s.companyId}__${email}`;
    const inviteRef = db.doc(`invites/${inviteId}`);
    if ((await inviteRef.get()).exists) continue;
    updates.push({
      ref: inviteRef,
      merge: false,
      data: {
        id: inviteId,
        companyId: s.companyId,
        companyName: company.name || 'Company',
        email,
        role: ROLES.has(s.role) && s.role !== 'ADMIN' ? s.role : 'STAFF',
        staffId: snap.id,
        assignedWarehouseId: s.assignedWarehouseId ?? null,
        status: 'PENDING',
        invitedByUid: company.ownerUid || 'migration',
        invitedByEmail: 'migration',
        createdAt: now,
      },
      note: `invite ${inviteId}: created for staff ${snap.id}${s.role === 'ADMIN' ? ' (ADMIN downgraded to STAFF; promote after review)' : ''}`,
    });
  }

  // ---------------------------------------------------------------- output
  console.log(`Changes (${updates.length}):`);
  updates.forEach(u => console.log(`  • ${u.note}`));
  console.log(`\nNeeds manual review (${findings.length}):`);
  findings.forEach(f => console.log(`  ! ${f}`));

  if (!APPLY) {
    console.log('\nDry run only. Re-run with --apply to write the changes.');
    return;
  }
  await commit(db);
  console.log(`\nApplied ${updates.length} change(s).`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
