/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';

// Use import.meta.glob to optionally load the config file if it exists (AI Studio environment)
// This prevents build failures in environments like GitHub Actions where the file is missing.
let configJson: any = {};
try {
  const configFiles = import.meta.glob('../firebase-applet-config.json', { eager: true });
  configJson = (configFiles['../firebase-applet-config.json'] as any)?.default || {};
} catch (e) {
  console.warn("Firebase config file not found, relying on environment variables.");
}

// Helper to sanitize env variables (strip accidental quotes)
const sanitize = (val: any) => typeof val === 'string' ? val.replace(/['"]/g, '').trim() : val;

export const firebaseConfig: FirebaseOptions & { firestoreDatabaseId?: string } = {
  apiKey: sanitize(import.meta.env.VITE_FIREBASE_API_KEY || configJson.apiKey),
  authDomain: sanitize(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || configJson.authDomain),
  projectId: sanitize(import.meta.env.VITE_FIREBASE_PROJECT_ID || configJson.projectId),
  storageBucket: sanitize(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || configJson.storageBucket),
  messagingSenderId: sanitize(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || configJson.messagingSenderId),
  appId: sanitize(import.meta.env.VITE_FIREBASE_APP_ID || configJson.appId),
  measurementId: sanitize(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || configJson.measurementId),
  firestoreDatabaseId: sanitize(import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || configJson.firestoreDatabaseId || "(default)")
};

// CRITICAL: Ensure app doesn't crash on init if keys are missing, 
// so we can show a helpful UI error instead.
const isValidConfig = !!firebaseConfig.apiKey && !!firebaseConfig.projectId;
const appEnv = sanitize(import.meta.env.VITE_APP_ENV || 'development');

if (!isValidConfig) {
  console.error(`CRITICAL: Firebase configuration is incomplete [Env: ${appEnv}]. Authentication and database features will fail.`);
} else {
  console.log(`Firebase Config loaded successfully for [${appEnv}] from ` + (import.meta.env.VITE_FIREBASE_API_KEY ? "environment" : "JSON file") + ".");
}

const app = initializeApp(firebaseConfig);

// Use initializeFirestore with robust settings for the iframe/mobile environment
const urlParams = new URLSearchParams(window.location.search);
const forceDefaultDb = urlParams.get('forceDefaultDb') === 'true';
const databaseId = forceDefaultDb ? "(default)" : (firebaseConfig.firestoreDatabaseId || "(default)");

console.log("Initializing Firestore with Database ID:", databaseId);
export const db = initializeFirestore(app, {
  host: "firestore.googleapis.com",
  ssl: true,
}, databaseId);

export const auth = getAuth(app);
console.log("Firebase initialized.");

// Test connection to Firestore with retries
async function testConnection(retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
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
