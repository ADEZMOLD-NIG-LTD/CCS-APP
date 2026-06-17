/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FirebaseOptions } from 'firebase/app';

// Mock config
export const firebaseConfig = {
  apiKey: "mock-api-key",
  projectId: "mock-project-id",
  authDomain: "mock-auth-domain",
  storageBucket: "mock-storage-bucket",
  messagingSenderId: "mock-sender-id",
  appId: "mock-app-id",
  measurementId: "mock-measurement-id",
  firestoreDatabaseId: "(default)"
};

export const initializeApp = (options: FirebaseOptions) => {
  const appObj = { options };
  return appObj;
};

export const getApps = () => {
  return [];
};

// Listeners registry for local state updates
const listeners: Set<() => void> = new Set();
const triggerListeners = () => {
  listeners.forEach(l => {
    try { l(); } catch (e) { console.error("Error in mock change listener:", e); }
  });
};

// Helper to get database
const getDbData = (): Record<string, Record<string, any>> => {
  try {
    const raw = localStorage.getItem('ccs_mock_db');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
};

const saveDbData = (data: Record<string, Record<string, any>>) => {
  try {
    localStorage.setItem('ccs_mock_db', JSON.stringify(data));
    triggerListeners();
  } catch (e) {
    console.error("Local storage save failed", e);
  }
};

// Seed demo data on initial load if empty
const initDb = () => {
  const data = getDbData();
  let modified = false;

  if (!data['users']) {
    data['users'] = {
      'demo_admin_profile': {
        uid: 'demo_admin_profile',
        email: 'demo@ccs.com',
        displayName: 'Training User',
        role: 'ADMIN',
        companyId: 'demo_company',
        createdAt: new Date().toISOString()
      },
      'wasiu_profile': {
        uid: 'wasiu_profile',
        email: 'wasiuadebisi89@gmail.com',
        displayName: 'Wasiu Adebisi',
        role: 'ADMIN',
        companyId: 'demo_company',
        createdAt: new Date().toISOString()
      }
    };
    modified = true;
  }
  if (!data['companies']) {
    data['companies'] = {
      'demo_company': {
        id: 'demo_company',
        name: 'CCS Training Demo',
        ownerEmail: 'demo@ccs.com',
        createdAt: new Date().toISOString(),
        isApproved: true
      }
    };
    modified = true;
  }
  if (!data['warehouses']) {
    data['warehouses'] = {
      'demo_warehouse_1': {
        id: 'demo_warehouse_1',
        companyId: 'demo_company',
        name: 'Main Demo Warehouse',
        location: 'Lagos, Nigeria',
        capacity: 5000,
        createdAt: new Date().toISOString()
      }
    };
    modified = true;
  }
  if (!data['suppliers']) {
    data['suppliers'] = {
      'demo_supplier_1': {
        id: 'demo_supplier_1',
        companyId: 'demo_company',
        name: 'John Doe Farms',
        location: 'Ondo State',
        phone: '08012345678',
        email: 'john@farms.com',
        previousBalance: 0,
        createdAt: new Date().toISOString()
      }
    };
    modified = true;
  }

  if (modified) {
    saveDbData(data);
  }
};
initDb();

// Mock Auth Class
class MockAuth {
  private currentUser: any = null;
  private authListeners: Set<(user: any) => void> = new Set();

  constructor() {
    try {
      const savedUser = localStorage.getItem('ccs_mock_auth_user');
      if (savedUser) {
        this.currentUser = JSON.parse(savedUser);
      }
    } catch (e) {}
  }

  getCurrentUser() {
    return this.currentUser;
  }

  setCurrentUser(user: any) {
    this.currentUser = user;
    if (user) {
      localStorage.setItem('ccs_mock_auth_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('ccs_mock_auth_user');
    }
    this.authListeners.forEach(listener => listener(this.currentUser));
  }

  onAuthStateChanged(listener: (user: any) => void) {
    this.authListeners.add(listener);
    setTimeout(() => listener(this.currentUser), 0);
    return () => {
      this.authListeners.delete(listener);
    };
  }
}

export const authInstance = new MockAuth();
export const getAuth = () => authInstance;

export const signInAnonymously = async (authObj: any) => {
  const mockUser = {
    uid: 'demo_admin_user_anonymous',
    isAnonymous: true,
    email: 'demo@ccs.com',
    displayName: 'Training User'
  };
  authInstance.setCurrentUser(mockUser);
  return { user: mockUser };
};

export const signInWithEmailAndPassword = async (authObj: any, email: string, password: string) => {
  const data = getDbData();
  const users = data['users'] || {};
  const userProfile = Object.values(users).find(u => u.email?.toLowerCase() === email.toLowerCase());

  if (userProfile) {
    const mockUser = {
      uid: userProfile.uid || 'user_demo_wasiu',
      email: userProfile.email,
      displayName: userProfile.displayName || 'User'
    };
    authInstance.setCurrentUser(mockUser);
    return { user: mockUser };
  } else {
    // Auto-create profile for easy login during review
    const uid = 'user_' + Math.random().toString(36).substring(7);
    const mockUser = {
      uid,
      email,
      displayName: email.split('@')[0]
    };
    
    const newProfile = {
      uid,
      email,
      displayName: mockUser.displayName,
      role: 'ADMIN',
      companyId: 'demo_company',
      createdAt: new Date().toISOString()
    };
    data['users'] = data['users'] || {};
    data['users'][uid] = newProfile;
    saveDbData(data);

    authInstance.setCurrentUser(mockUser);
    return { user: mockUser };
  }
};

export const createUserWithEmailAndPassword = async (authObj: any, email: string, password: string) => {
  const uid = 'user_' + Math.random().toString(36).substring(7);
  const mockUser = {
    uid,
    email,
    displayName: email.split('@')[0]
  };
  
  const data = getDbData();
  data['users'] = data['users'] || {};
  data['users'][uid] = {
    uid,
    email,
    displayName: mockUser.displayName,
    role: 'ADMIN',
    companyId: 'demo_company',
    createdAt: new Date().toISOString()
  };
  saveDbData(data);

  authInstance.setCurrentUser(mockUser);
  return { user: mockUser };
};

export const signOut = async (authObj: any) => {
  authInstance.setCurrentUser(null);
};

export const onAuthStateChanged = (authObj: any, listener: (user: any) => void) => {
  return authInstance.onAuthStateChanged(listener);
};

export const sendPasswordResetEmail = async (authObj: any, email: string) => {
  console.log("Mock password reset email sent to:", email);
  return true;
};

export const updateProfile = async (user: any, profileData: any) => {
  if (user) {
    const updated = { ...user, ...profileData };
    authInstance.setCurrentUser(updated);
  }
};

export const updatePassword = async (user: any, newPassword: string) => {
  console.log("Mock password updated for user");
  return true;
};

export const signInWithPopup = async (authObj: any, provider: any) => {
  const mockUser = {
    uid: 'google_provider_user',
    email: 'google-user@ccs.com',
    displayName: 'Google Training User'
  };
  authInstance.setCurrentUser(mockUser);
  return { user: mockUser };
};

export const signInWithRedirect = async (authObj: any, provider: any) => {
  const mockUser = {
    uid: 'google_provider_user',
    email: 'google-user@ccs.com',
    displayName: 'Google Training User'
  };
  authInstance.setCurrentUser(mockUser);
  return;
};

export class GoogleAuthProvider {
  static PROVIDER_ID = 'google.com';
  setCustomParameters(params: any) {
    return this;
  }
}

export class EmailAuthProvider {
  static PROVIDER_ID = 'password';
  static credential(email: string, password: string) {
    return { providerId: 'password', signInMethod: 'password', email, password };
  }
}

export const reauthenticateWithCredential = async (user: any, credential: any) => {
  return true;
};

export type User = any;

// Mock Firestore
export const getFirestore = () => {
  return { mock: true };
};

export const db = { mock: true };

export const collection = (dbObj: any, path: string) => {
  return { type: 'collection', path };
};

export const doc = (dbOrCollection: any, pathOrCreateId?: string, docId?: string) => {
  if (dbOrCollection && dbOrCollection.type === 'collection') {
    return { type: 'doc', collectionPath: dbOrCollection.path, docId: pathOrCreateId };
  }
  return { type: 'doc', collectionPath: pathOrCreateId, docId: docId };
};

export const query = (collectionRef: any, ...queryConsts: any[]) => {
  return {
    type: 'query',
    collectionPath: collectionRef.path,
    filters: queryConsts.filter(q => q.type === 'where'),
    orderBy: queryConsts.filter(q => q.type === 'orderBy'),
    limit: queryConsts.find(q => q.type === 'limit')?.value || null
  };
};

export const where = (field: string, operator: string, value: any) => {
  return { type: 'where', field, operator, value };
};

export const orderBy = (field: string, direction: 'asc' | 'desc' = 'asc') => {
  return { type: 'orderBy', field, direction };
};

export const limit = (value: number) => {
  return { type: 'limit', value };
};

const executeQuery = (queryObj: any) => {
  const data = getDbData();
  const collectionPath = queryObj.collectionPath;
  const docsMap = data[collectionPath] || {};
  let list = Object.entries(docsMap).map(([id, docData]: [string, any]) => ({
    id,
    ...docData,
    ref: { type: 'doc', collectionPath, docId: id }
  }));

  if (queryObj.filters) {
    queryObj.filters.forEach((filter: any) => {
      const { field, operator, value } = filter;
      list = list.filter(item => {
        let itemVal = item[field];
        if (operator === '==') return itemVal === value;
        if (operator === '!=') return itemVal !== value;
        if (operator === '>') return itemVal > value;
        if (operator === '>=') return itemVal >= value;
        if (operator === '<') return itemVal < value;
        if (operator === '<=') return itemVal <= value;
        if (operator === 'array-contains') return Array.isArray(itemVal) && itemVal.includes(value);
        return true;
      });
    });
  }

  if (queryObj.orderBy) {
    queryObj.orderBy.forEach((order: any) => {
      const { field, direction } = order;
      list.sort((a, b) => {
        const valA = a[field];
        const valB = b[field];
        if (valA === undefined) return 1;
        if (valB === undefined) return -1;
        
        if (typeof valA === 'string' && typeof valB === 'string') {
          return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return direction === 'asc' ? (Number(valA) - Number(valB)) : (Number(valB) - Number(valA));
      });
    });
  }

  if (queryObj.limit !== null && queryObj.limit !== undefined) {
    list = list.slice(0, queryObj.limit);
  }

  return list;
};

class MockDocumentSnapshot {
  constructor(public id: string, private dataObj: any) {}

  exists() {
    return !!this.dataObj;
  }

  data() {
    return this.dataObj ? { ...this.dataObj } : undefined;
  }

  get(field: string) {
    return this.dataObj ? this.dataObj[field] : undefined;
  }
}

class MockQuerySnapshot {
  docs: any[] = [];
  empty: boolean = true;
  size: number = 0;

  constructor(list: any[]) {
    this.docs = list.map(item => ({
      id: item.id,
      ref: item.ref,
      data: () => {
        const d = { ...item };
        delete d.id;
        delete d.ref;
        return d;
      },
      get: (field: string) => item[field]
    }));
    this.empty = list.length === 0;
    this.size = list.length;
  }

  forEach(callback: (doc: any) => void) {
    this.docs.forEach(callback);
  }
}

export const getDoc = async (docRef: any) => {
  const data = getDbData();
  const coll = data[docRef.collectionPath] || {};
  const docData = coll[docRef.docId] || null;
  return new MockDocumentSnapshot(docRef.docId, docData);
};

export const getDocFromServer = getDoc;

export const getDocs = async (queryOrCollection: any) => {
  let list: any[];
  if (queryOrCollection.type === 'collection') {
    list = executeQuery({ collectionPath: queryOrCollection.path });
  } else {
    list = executeQuery(queryOrCollection);
  }
  return new MockQuerySnapshot(list);
};

export const setDoc = async (docRef: any, docData: any, options?: any) => {
  const data = getDbData();
  data[docRef.collectionPath] = data[docRef.collectionPath] || {};
  
  if (options && options.merge) {
    data[docRef.collectionPath][docRef.docId] = {
      ...(data[docRef.collectionPath][docRef.docId] || {}),
      ...docData
    };
  } else {
    data[docRef.collectionPath][docRef.docId] = { ...docData };
  }
  
  saveDbData(data);
  return true;
};

export const addDoc = async (collectionRef: any, docData: any) => {
  const id = 'doc_' + Math.random().toString(36).substring(7);
  const docRef = { type: 'doc', collectionPath: collectionRef.path, docId: id };
  await setDoc(docRef, docData);
  return { id, ref: docRef };
};

export const updateDoc = async (docRef: any, docData: any) => {
  const data = getDbData();
  const coll = data[docRef.collectionPath] || {};
  const existing = coll[docRef.docId] || {};
  
  const updated = { ...existing };
  Object.keys(docData).forEach(key => {
    updated[key] = docData[key];
  });
  
  coll[docRef.docId] = updated;
  data[docRef.collectionPath] = coll;
  saveDbData(data);
  return true;
};

export const deleteDoc = async (docRef: any) => {
  const data = getDbData();
  const coll = data[docRef.collectionPath] || {};
  delete coll[docRef.docId];
  data[docRef.collectionPath] = coll;
  saveDbData(data);
  return true;
};

class MockWriteBatch {
  private operations: Array<() => Promise<void>> = [];

  delete(docRef: any) {
    this.operations.push(async () => {
      await deleteDoc(docRef);
    });
  }

  set(docRef: any, data: any, options?: any) {
    this.operations.push(async () => {
      await setDoc(docRef, data, options);
    });
  }

  update(docRef: any, data: any) {
    this.operations.push(async () => {
      await updateDoc(docRef, data);
    });
  }

  async commit() {
    for (const op of this.operations) {
      await op();
    }
  }
}

export const writeBatch = (dbObj: any) => {
  return new MockWriteBatch();
};

export const onSnapshot = (queryOrDocRef: any, callback: (snapshot: any) => void) => {
  const runCallback = async () => {
    try {
      if (queryOrDocRef.type === 'doc') {
        const snap = await getDoc(queryOrDocRef);
        callback(snap);
      } else if (queryOrDocRef.type === 'collection') {
        const list = executeQuery({ collectionPath: queryOrDocRef.path });
        callback(new MockQuerySnapshot(list));
      } else {
        const list = executeQuery(queryOrDocRef);
        callback(new MockQuerySnapshot(list));
      }
    } catch (e) {
      console.error("onSnapshot failed to execute callback:", e);
    }
  };

  listeners.add(runCallback);
  runCallback();

  return () => {
    listeners.delete(runCallback);
  };
};
