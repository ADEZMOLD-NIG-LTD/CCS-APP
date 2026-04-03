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
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);
console.log("Firebase initialized.");
