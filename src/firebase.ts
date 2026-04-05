/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';

// Initialize Firebase SDK
const currentProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
const currentDatabaseId = import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || "(default)";

console.log("--- Firebase Environment Diagnostics ---");
console.log("Mode:", import.meta.env.MODE);
console.log("Base URL:", import.meta.env.BASE_URL);
console.log("Project ID:", currentProjectId || "MISSING (VITE_FIREBASE_PROJECT_ID)");
console.log("Auth Domain:", import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "MISSING (VITE_FIREBASE_AUTH_DOMAIN)");
console.log("API Key (masked):", import.meta.env.VITE_FIREBASE_API_KEY ? `${import.meta.env.VITE_FIREBASE_API_KEY.substring(0, 5)}...` : "MISSING (VITE_FIREBASE_API_KEY)");
console.log("App ID:", import.meta.env.VITE_FIREBASE_APP_ID ? "PRESENT" : "MISSING (VITE_FIREBASE_APP_ID)");

// Log all VITE_ keys to see what's actually available
const viteKeys = Object.keys(import.meta.env).filter(key => key.startsWith('VITE_'));
console.log("Available VITE_ keys:", viteKeys.length > 0 ? viteKeys.join(", ") : "NONE");
console.log("---------------------------------------");

if (!currentProjectId || !import.meta.env.VITE_FIREBASE_API_KEY || !import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || !import.meta.env.VITE_FIREBASE_APP_ID) {
  const missing = [];
  if (!currentProjectId) missing.push("VITE_FIREBASE_PROJECT_ID");
  if (!import.meta.env.VITE_FIREBASE_API_KEY) missing.push("VITE_FIREBASE_API_KEY");
  if (!import.meta.env.VITE_FIREBASE_AUTH_DOMAIN) missing.push("VITE_FIREBASE_AUTH_DOMAIN");
  if (!import.meta.env.VITE_FIREBASE_APP_ID) missing.push("VITE_FIREBASE_APP_ID");
  
  console.error("CRITICAL ERROR: The following Firebase secrets are missing from the build: " + missing.join(", "));
  console.error("This means your GitHub Secrets are NOT being passed to the 'npm run build' command.");
  console.error("1. Go to GitHub Repo > Settings > Secrets and variables > Actions.");
  console.error("2. Ensure they are in the 'Secrets' tab, NOT the 'Variables' tab.");
  console.error("3. Ensure the names are EXACTLY as listed above (all caps, with underscores).");
}

export const firebaseConfig: FirebaseOptions & { firestoreDatabaseId?: string } = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  firestoreDatabaseId: currentDatabaseId,
};

const app = initializeApp(firebaseConfig);

// Use initializeFirestore with long polling to bypass potential WebSocket issues in the iframe environment
console.log("Initializing Firestore...");
// Default to '(default)' if no database ID is provided, as this is the standard for most Firebase projects
const databaseId = firebaseConfig.firestoreDatabaseId || "(default)";
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, databaseId);

export const auth = getAuth(app);
console.log("Firebase initialized.");

// Test connection to Firestore
async function testConnection() {
  try {
    console.log("Testing Firestore connection...");
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection test successful.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Firestore Error: The client is offline.");
      console.group("Troubleshooting Steps:");
      console.error("1. Check your GitHub Secrets: Ensure VITE_FIREBASE_PROJECT_ID and others are correctly set in your repo settings.");
      if (firebaseConfig.projectId?.includes('gen-lang-client')) {
        console.error("   ⚠️ WARNING: Your app is still using the AI Studio project ID. This means your GitHub Secrets are NOT being applied.");
      }
      console.error("2. Enable Firestore API: Go to https://console.cloud.google.com/apis/library/firestore.googleapis.com and click 'Enable'.");
      console.error("3. Create Database: Ensure you have created a database named '(default)' in the Firebase Console.");
      console.error("4. Authorized Domains: Ensure 'commodityclick.com.ng' is added to Authentication > Settings > Authorized domains.");
      console.groupEnd();
    } else {
      console.warn("Firestore connection test warning (this is normal if the 'test/connection' doc doesn't exist):", error);
    }
  }
}
testConnection();
