/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';

// Import the Firebase configuration
import firebaseConfigData from '../firebase-applet-config.json';

export const firebaseConfig: FirebaseOptions & { firestoreDatabaseId?: string } = {
  ...firebaseConfigData,
  firestoreDatabaseId: firebaseConfigData.firestoreDatabaseId || "(default)"
};

const app = initializeApp(firebaseConfig);

// Use initializeFirestore with robust settings for the iframe/mobile environment
const urlParams = new URLSearchParams(window.location.search);
const forceDefaultDb = urlParams.get('forceDefaultDb') === 'true';
const databaseId = forceDefaultDb ? "(default)" : (firebaseConfig.firestoreDatabaseId || "(default)");

console.log("Initializing Firestore with Database ID:", databaseId);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  experimentalAutoDetectLongPolling: false,
}, databaseId);

export const auth = getAuth(app);
console.log("Firebase initialized.");

// Test connection to Firestore
async function testConnection() {
  try {
    console.log("Testing Firestore connection...");
    const testDoc = doc(db, '_health_check_', 'ping');
    await getDocFromServer(testDoc);
    console.log("Firestore connection successful.");
  } catch (error: any) {
    // Permission denied is actually a success! It means we reached the server.
    if (error.code === 'permission-denied') {
      console.log("Firestore connection successful (reached server).");
      return;
    }
    console.error("Firestore Connection Test Error:", error.code, error.message);
  }
}
testConnection();
