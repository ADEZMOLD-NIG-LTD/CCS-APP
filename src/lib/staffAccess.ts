/**
 * Creates a Firebase Auth login for a newly invited staff member without signing the
 * current admin out, then emails them a link to set their own password.
 *
 * No password is ever chosen, shown or emailed by the application.
 */

import { getApps, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { firebaseConfig, isFirebaseConfigured } from '../firebase';
import { isDemoRuntime } from './runtimeMode';

const PROVISIONING_APP = 'staff-provisioning';

function randomPassword(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)) + 'Aa1!';
}

export type ProvisionResult = 'created' | 'existing' | 'unavailable';

export async function provisionStaffLogin(email: string): Promise<ProvisionResult> {
  if (isDemoRuntime || !isFirebaseConfigured) return 'unavailable';
  const { firestoreDatabaseId: _databaseId, ...options } = firebaseConfig;
  const app = getApps().find(a => a.name === PROVISIONING_APP) ?? initializeApp(options, PROVISIONING_APP);
  const secondaryAuth = getAuth(app);

  try {
    await createUserWithEmailAndPassword(secondaryAuth, email, randomPassword());
  } catch (error) {
    if ((error as { code?: string })?.code === 'auth/email-already-in-use') return 'existing';
    throw error;
  } finally {
    await signOut(secondaryAuth).catch(() => undefined);
  }

  await sendPasswordResetEmail(secondaryAuth, email, { url: window.location.origin });
  return 'created';
}
