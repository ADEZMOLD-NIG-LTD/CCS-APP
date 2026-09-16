/**
 * Grants or revokes platform (super) admin access.
 *
 *   npm run admin:grant-super-admin -- person@example.com
 *   npm run admin:grant-super-admin -- person@example.com --revoke
 *   npm run admin:grant-super-admin -- --list
 *
 * Platform admins are stored in platform_admins/{uid}. The security rules make that collection
 * unwritable from the app, so this script (Admin SDK) or the Firebase console is the only way in.
 */

import { FieldValue } from 'firebase-admin/firestore';
import { initAdmin } from './lib/admin';

async function main() {
  const args = process.argv.slice(2);
  const { auth, db, projectId } = initAdmin();

  if (args.includes('--list')) {
    const snap = await db.collection('platform_admins').get();
    console.log(`Platform admins in ${projectId}: ${snap.size}`);
    snap.docs.forEach(d => console.log(`  ${d.id}  ${d.get('email') ?? ''}`));
    return;
  }

  const email = args.find(a => !a.startsWith('--'))?.trim().toLowerCase();
  const revoke = args.includes('--revoke');
  if (!email) {
    console.error('Usage: npm run admin:grant-super-admin -- <email> [--revoke] | --list');
    process.exitCode = 1;
    return;
  }

  const user = await auth.getUserByEmail(email);
  const ref = db.doc(`platform_admins/${user.uid}`);

  if (revoke) {
    await ref.delete();
    console.log(`Revoked platform admin access for ${email} (${user.uid}) in ${projectId}.`);
    return;
  }

  if (!user.emailVerified) {
    console.error(`${email} has not verified their email address. Ask them to verify it first.`);
    process.exitCode = 1;
    return;
  }
  if (user.disabled) {
    console.error(`${email} is disabled in Firebase Authentication.`);
    process.exitCode = 1;
    return;
  }

  await ref.set({
    uid: user.uid,
    email,
    grantedAt: FieldValue.serverTimestamp(),
    grantedBy: process.env.USER || process.env.USERNAME || 'cli',
  });
  console.log(`Granted platform admin access to ${email} (${user.uid}) in ${projectId}. They may need to reload the app.`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
