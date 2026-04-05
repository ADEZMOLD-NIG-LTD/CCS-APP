/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';

// Initialize Firebase SDK
const BUILD_TIME = "2026-04-05 22:18 UTC";
const currentProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || "gen-lang-client-0555602350";
const currentDatabaseId = import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || "(default)";

console.log("--- Firebase Environment Diagnostics ---");
console.log("Build Time:", BUILD_TIME);
console.log("Mode:", import.meta.env.MODE);
console.log("Project ID:", currentProjectId);
console.log("Auth Domain:", import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "gen-lang-client-0555602350.firebaseapp.com");
console.log("---------------------------------------");

export const firebaseConfig: FirebaseOptions & { firestoreDatabaseId?: string } = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyB8f_PfkgNSMhFxQ71yGXZLPzVOcvmKdmk",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "gen-lang-client-0555602350.firebaseapp.com",
  projectId: currentProjectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "gen-lang-client-0555602350.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "828527972403",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:828527972403:web:88bcbd839ca8bfe226d346",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "",
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
    // Attempt to get a document from a 'test' collection
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection test successful (or document not found, which is fine).");
  } catch (error) {
    console.error("Firestore Connection Test Error:", error);
    
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Firestore Error: The client is offline.");
      console.group("Troubleshooting Steps:");
      console.error("1. Enable Firestore API: Go to https://console.cloud.google.com/apis/library/firestore.googleapis.com and click 'Enable'. This is the most common cause.");
      console.error("2. Create Database: Go to the Firebase Console, click 'Firestore Database', and ensure you have created a database named '(default)'.");
      console.error("3. Check GitHub Secrets: Ensure VITE_FIREBASE_PROJECT_ID and others are correctly set in your repo settings if you want to use your own keys.");
      console.error("4. Authorized Domains: Ensure 'commodityclick.com.ng' is added to Authentication > Settings > Authorized domains in the Firebase Console.");
      console.groupEnd();
    }
  }
}
testConnection();
