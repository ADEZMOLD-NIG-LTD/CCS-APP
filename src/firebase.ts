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

// If real credentials are missing, we fall back to mock credentials so that the app stays functional.
export const isMockFallback = !rawApiKey || !rawProjectId;

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
  const urlParams = new URLSearchParams(window.location.search);
  const forceDefaultDb = urlParams.get('forceDefaultDb') === 'true';
  const databaseId = forceDefaultDb ? "(default)" : (firebaseConfig.firestoreDatabaseId || "(default)");
  
  console.log("Initializing Firestore with Database ID:", databaseId);
  db = getFirestore(app, databaseId);
  
  auth = getAuth(app);
  console.log("Firebase initialized successfully (using " + (isValidConfig ? "loaded" : "mock fallback") + " config).");
} catch (error: any) {
  console.error("FAILED to initialize Firebase:", error);
  (window as any).FIREBASE_INIT_ERROR = error.message;
}

export { app, auth, db };

// Test connection to Firestore with retries
async function testConnection(retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      if (!db) {
        console.warn("Firestore connection test skipped: No database instance.");
        return;
      }
      console.log(`Testing Firestore connection (attempt ${i + 1})...`);
      // Use a simple collection reference for the test
      const testDoc = doc(db, '_health_check_', 'ping');
      
      // Use a timeout for the health check
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Connection test timeout")), 20000)
      );
      
      const snapshot = await Promise.race([
        getDocFromServer(testDoc),
        timeoutPromise
      ]) as any;
      
      console.log("Firestore connection successful. Document exists:", snapshot.exists());
      return;
    } catch (error: any) {
      // Permission denied is actually a success! It means we reached the server.
      if (error.code === 'permission-denied') {
        console.log("Firestore connection successful (reached server but permission denied). This is expected if the doc doesn't exist or rules are strict.");
        return;
      }
      
      console.warn(`Firestore Connection Attempt ${i + 1} failed:`, {
        code: error.code,
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      
      if (i === retries - 1) {
        console.error("All Firestore connection attempts failed. This might be due to network restrictions or a pending database provisioning. Please try refreshing in a few minutes.");
      } else {
        // Wait longer between retries
        const delay = (i + 1) * 3000;
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
}
testConnection();
