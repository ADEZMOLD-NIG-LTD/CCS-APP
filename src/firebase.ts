/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
export const firebaseConfig: FirebaseOptions & { firestoreDatabaseId?: string } = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyB8f_PfkgNSMhFxQ71yGXZLPzVOcvmKdmk",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "gen-lang-client-0555602350.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "gen-lang-client-0555602350",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "gen-lang-client-0555602350.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "828527972403",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:828527972403:web:88bcbd839ca8bfe226d346",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "",
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || "ai-studio-086bebaa-d248-491f-a312-4b87527790a1",
};

// Initialize Firebase SDK
console.log("Initializing Firebase with config:", { 
  projectId: firebaseConfig.projectId, 
  databaseId: firebaseConfig.firestoreDatabaseId 
});
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
      console.error("Firestore Error: The client is offline. Please check your Firebase configuration and ensure the Firestore API is enabled.");
    } else {
      console.warn("Firestore connection test warning (this is normal if the 'test/connection' doc doesn't exist):", error);
    }
  }
}
testConnection();
