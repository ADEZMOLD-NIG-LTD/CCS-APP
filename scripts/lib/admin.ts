/**
 * Firebase Admin bootstrap for maintenance scripts.
 *
 * Credentials, in order of preference:
 *   FIREBASE_SERVICE_ACCOUNT        service-account JSON (single line)
 *   GOOGLE_APPLICATION_CREDENTIALS  path to a service-account JSON file, or `gcloud auth application-default login`
 */

import dotenv from 'dotenv';
import { applicationDefault, cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config();

export function initAdmin() {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error('Set FIREBASE_PROJECT_ID (or VITE_FIREBASE_PROJECT_ID) to the target Firebase project.');
  }
  const databaseId = process.env.FIREBASE_FIRESTORE_DATABASE_ID || process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || '(default)';
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  const app = initializeApp({
    credential: serviceAccount ? cert(JSON.parse(serviceAccount)) : applicationDefault(),
    projectId,
  });
  return {
    projectId,
    databaseId,
    auth: getAuth(app),
    db: databaseId === '(default)' ? getFirestore(app) : getFirestore(app, databaseId),
  };
}
