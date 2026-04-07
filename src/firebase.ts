/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';

// Import the Firebase configuration
import firebaseConfigData from '../firebase-applet-config.json';

console.log("Firebase Config Data:", JSON.stringify({
  projectId: firebaseConfigData.projectId,
  databaseId: firebaseConfigData.firestoreDatabaseId,
  authDomain: firebaseConfigData.authDomain
}));

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
