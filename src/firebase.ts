/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import * as localBackend from './mockFirebase';
import { isDemoRuntime } from './lib/runtimeMode';
import { logger } from './lib/logger';

// Optional local config file (AI Studio / local development). Production uses VITE_FIREBASE_* variables.
let configJson: Record<string, string> = {};
try {
  const configFiles = import.meta.glob('../firebase-applet-config.json', { eager: true });
  const loaded = configFiles['../firebase-applet-config.json'] as { default?: Record<string, string> } | undefined;
  if (loaded?.default) configJson = loaded.default;
} catch {
  // File not present: rely on environment variables.
}

const clean = (value: unknown): string => (typeof value === 'string' ? value.replace(/['"]/g, '').trim() : '');
const env = import.meta.env;

export const firebaseConfig: FirebaseOptions & { firestoreDatabaseId: string } = {
  apiKey: clean(env.VITE_FIREBASE_API_KEY || configJson.apiKey),
  authDomain: clean(env.VITE_FIREBASE_AUTH_DOMAIN || configJson.authDomain),
  projectId: clean(env.VITE_FIREBASE_PROJECT_ID || configJson.projectId),
  storageBucket: clean(env.VITE_FIREBASE_STORAGE_BUCKET || configJson.storageBucket),
  messagingSenderId: clean(env.VITE_FIREBASE_MESSAGING_SENDER_ID || configJson.messagingSenderId),
  appId: clean(env.VITE_FIREBASE_APP_ID || configJson.appId),
  measurementId: clean(env.VITE_FIREBASE_MEASUREMENT_ID || configJson.measurementId) || undefined,
  firestoreDatabaseId: clean(env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || configJson.firestoreDatabaseId) || '(default)',
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
export const appEnv = clean(env.VITE_APP_ENV) || (env.PROD ? 'production' : 'development');

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore;
let initError: string | null = null;

if (isDemoRuntime) {
  db = localBackend.getFirestore() as unknown as Firestore;
} else if (isFirebaseConfigured) {
  try {
    const { firestoreDatabaseId, ...options } = firebaseConfig;
    app = getApps()[0] ?? initializeApp(options);
    try {
      // A busy company's ledger is about a megabyte. Without a persistent cache that is
      // downloaded again on every app start; with it, data is served from the device and only
      // changed documents are fetched - minutes versus seconds on a slow mobile connection.
      db = initializeFirestore(
        app,
        {
          ignoreUndefinedProperties: true,
          localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
        },
        firestoreDatabaseId
      );
    } catch {
      try {
        // No IndexedDB (private window, blocked storage) or already initialised: carry on
        // without the cache rather than failing to start.
        db = initializeFirestore(app, { ignoreUndefinedProperties: true }, firestoreDatabaseId);
      } catch {
        db = getFirestore(app, firestoreDatabaseId);
      }
    }
    auth = getAuth(app);
    logger.debug(`Firebase initialised for ${appEnv}`);
  } catch (error) {
    initError = error instanceof Error ? error.message : String(error);
    logger.error('Firebase initialisation failed', error);
    db = localBackend.getFirestore() as unknown as Firestore;
  }
} else {
  // No configuration: only demo mode is usable. Keep db defined so imports never crash.
  db = localBackend.getFirestore() as unknown as Firestore;
}

export { app, auth, db, initError };
