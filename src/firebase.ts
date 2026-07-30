/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';

// Use import.meta.glob to optionally load the config file if it exists (AI Studio environment)
// This prevents build failures in environments like GitHub Actions where the file is missing.
let configJson: any = {};
try {
  // In production builds, we expect environment variables.
  // We use the 'import.meta.glob' to check for the local config file purely for developer convenience 
  // in the AI Studio preview environment.
  const configFiles = import.meta.glob('../firebase-applet-config.json', { eager: true });
  const configKey = '../firebase-applet-config.json';
  if (configFiles && configFiles[configKey]) {
    configJson = (configFiles[configKey] as any).default || {};
  }
} catch (e) {
  // Silence error if file is missing in prod build
}

// Helper to sanitize env variables (strip accidental quotes)
const sanitize = (val: any) => typeof val === 'string' ? val.replace(/['"]/g, '').trim() : val;

const rawApiKey = sanitize(import.meta.env.VITE_FIREBASE_API_KEY || configJson.apiKey);
const rawProjectId = sanitize(import.meta.env.VITE_FIREBASE_PROJECT_ID || configJson.projectId);

// Detect if we are running in the AI Studio preview/developer environment
const isAIStudioPreview = typeof window !== 'undefined' && (
  window.location.hostname.includes('.run.app') || 
  window.location.hostname.includes('localhost')
);

// If real credentials are missing or if we are inside the AI Studio preview but lack config JSON, fall back to mock.
export const isMockFallback = !rawApiKey || !rawProjectId || 
  rawApiKey === "mock-api-key-safe-fallback" || 
  rawProjectId === "mock-project-safe-fallback" || 
  (isAIStudioPreview && Object.keys(configJson).length === 0);

export const firebaseConfig: FirebaseOptions & { firestoreDatabaseId?: string } = {
  apiKey: rawApiKey || "mock-api-key-safe-fallback",
  authDomain: sanitize(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || configJson.authDomain) || "mock-project-safe-fallback.firebaseapp.com",
  projectId: rawProjectId || "mock-project-safe-fallback",
  storageBucket: sanitize(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || configJson.storageBucket) || "mock-project-safe-fallback.appspot.com",
  messagingSenderId: sanitize(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || configJson.messagingSenderId) || "123456789",
  appId: sanitize(import.meta.env.VITE_FIREBASE_APP_ID || configJson.appId) || "1:123456789:web:abcdef123456",
  measurementId: sanitize(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || configJson.measurementId),
  firestoreDatabaseId: sanitize(import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || configJson.firestoreDatabaseId || "(default)")
};

// CRITICAL: Ensure app doesn't crash on init if keys are missing in production.
// During development we allow running in offline fallback mode using mockFirebase.ts.
const isValidConfig = !isMockFallback;
const appEnv = sanitize(import.meta.env.VITE_APP_ENV || 'development');

if (!isValidConfig) {
  if (appEnv === 'production') {
    const errorMsg = `CRITICAL: Firebase configuration is incomplete for environment: ${appEnv}. 
    Please ensure your environment variables (VITE_FIREBASE_*) are configured.`;
    console.error(errorMsg);
    (window as any).FIREBASE_CONFIG_ERROR = errorMsg;
  } else {
    console.log("No real Firebase configuration detected. Safe-booting in Local / Offline Mock Mode.");
  }
} else {
  console.log(`Firebase Config loaded successfully for [${appEnv}] from ` + 
    (import.meta.env.VITE_FIREBASE_API_KEY ? "environment variables" : "local JSON file") + ".");
}

// Log diagnostic masked config (don't log secrets!)
console.log("Firebase Diagnostic Check:", {
  env: appEnv,
  hasApiKey: !!firebaseConfig.apiKey,
  apiKeyPrefix: firebaseConfig.apiKey ? (firebaseConfig.apiKey as string).substring(0, 5) + "..." : "missing",
  projectId: firebaseConfig.projectId || "missing",
  authDomain: firebaseConfig.authDomain || "missing",
  databaseId: firebaseConfig.firestoreDatabaseId || "(default)"
});

let app: any;
let auth: any;
let db: any;

try {
  // Always initialize app, falling back to mock values if config is currently empty/invalid
  const activeConfig = isValidConfig ? firebaseConfig : {
    apiKey: "mock-api-key-safe-fallback",
    projectId: "mock-project-safe-fallback",
    authDomain: "mock-project-safe-fallback.firebaseapp.com",
    storageBucket: "mock-project-safe-fallback.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef123456",
  };

  app = initializeApp(activeConfig);
  
  // Use getFirestore(app, databaseId) for multiple database support
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const forceDefaultDb = urlParams.get('forceDefaultDb') === 'true';
  const customDbId = firebaseConfig.firestoreDatabaseId;
  const databaseId = forceDefaultDb ? "(default)" : (customDbId || "(default)");
  
  console.log("Initializing Firestore with Database ID:", databaseId);
  try {
    db = getFirestore(app, databaseId);
  } catch (e) {
    console.warn(`Failed to initialize Firestore with databaseId "${databaseId}", falling back to default database:`, e);
    db = getFirestore(app);
  }
  
  auth = getAuth(app);
  console.log("Firebase initialized successfully (using " + (isValidConfig ? "loaded" : "mock fallback") + " config).");
} catch (error: any) {
  console.error("FAILED to initialize Firebase:", error);
  (window as any).FIREBASE_INIT_ERROR = error.message;
}

export { app, auth, db };

// Test connection to Firestore with retries
async function testConnection(retries = 2) {
  if (isMockFallback) {
    console.log("Firestore connection test skipped: Operating in Local / Offline Mock Mode.");
    return;
  }
  for (let i = 0; i < retries; i++) {
    try {
      if (!db) {
        console.warn("Firestore connection test skipped: No database instance.");
        return;
      }
      console.log(`Testing Firestore connection (attempt ${i + 1})...`);
      // Use the publicly readable ping document from our firestore.rules
      const testDoc = doc(db, '_health_check_', 'ping');
      
      // Short 4-second timeout to avoid page loading hangs
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Connection test timeout")), 4000)
      );
      
      await Promise.race([
        getDocFromServer(testDoc),
        timeoutPromise
      ]);
      
      console.log("Firestore connection successful. Health check completed.");
      return;
    } catch (error: any) {
      // Server responses like permission-denied, not-found, unauthenticated mean server is connected and responding!
      if (
        error.code === 'permission-denied' ||
        error.code === 'not-found' ||
        error.code === 'unauthenticated' ||
        error.code === 'already-exists'
      ) {
        console.log(`Firestore connection successful (server responded with ${error.code}).`);
        return;
      }

      // If custom database failed, try fallback to default database
      if (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)') {
        try {
          console.warn("Attempting fallback to default Firestore database (default)...");
          const defaultDb = getFirestore(app);
          const defaultTestDoc = doc(defaultDb, '_health_check_', 'ping');
          await getDocFromServer(defaultTestDoc);
          db = defaultDb;
          console.log("Firestore connection successful using fallback default database.");
          return;
        } catch (fallbackError: any) {
          if (
            fallbackError.code === 'permission-denied' ||
            fallbackError.code === 'not-found' ||
            fallbackError.code === 'unauthenticated'
          ) {
            db = getFirestore(app);
            console.log("Firestore connection successful using default database (server responded).");
            return;
          }
        }
      }
      
      console.warn(`Firestore Connection Attempt ${i + 1} failed:`, {
        code: error.code,
        message: error.message
      });
      
      if (i === retries - 1) {
        console.warn("All Firestore connection attempts failed. Proceeding with caution.");
      } else {
        const delay = 1000;
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
}
testConnection();
