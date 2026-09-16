/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Local, in-browser stand-in for Firebase.
 *
 * Used in two situations only:
 *  1. Demo / training mode (see lib/runtimeMode.ts). All data lives in this browser's
 *     localStorage and never reaches the production database.
 *  2. Local development builds without any Firebase configuration, where vite aliases
 *     firebase/app, firebase/auth and firebase/firestore to this module. In that case
 *     authentication is intentionally unavailable and only demo mode works.
 */

type Json = Record<string, any>;
type Store = Record<string, Record<string, Json>>;

const STORAGE_KEY = 'ccs_demo_db_v2';
export const DEMO_COMPANY_ID = 'demo_company';
export const DEMO_USER_ID = 'demo_user';

const NOT_CONFIGURED = 'Firebase is not configured for this build. Use Training Demo mode or add the VITE_FIREBASE_* settings.';

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

let memoryStore: Store | null = null;
const listeners = new Set<() => void>();

function seed(): Store {
  const now = new Date().toISOString();
  const daysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(12, 0, 0, 0);
    return d.toISOString();
  };
  const deductions = { moistureActual: 8, moistureBenchmark: 8, tareWeight: 0, moldWeight: 0, otherDeduction: 0 };
  return {
    companies: {
      [DEMO_COMPANY_ID]: {
        id: DEMO_COMPANY_ID,
        name: 'CCS Training Company',
        ownerUid: DEMO_USER_ID,
        ownerEmail: 'demo@training.local',
        createdAt: now,
        isApproved: true,
        status: 'ACTIVE',
        subscriptionPlan: 'ENTERPRISE',
      },
    },
    users: {
      [DEMO_USER_ID]: {
        uid: DEMO_USER_ID,
        email: 'demo@training.local',
        displayName: 'Training User',
        role: 'ADMIN',
        companyId: DEMO_COMPANY_ID,
        status: 'ACTIVE',
        createdAt: now,
        lastPasswordUpdate: now,
      },
    },
    warehouses: {
      demo_wh_main: { id: 'demo_wh_main', companyId: DEMO_COMPANY_ID, name: 'Main Warehouse', location: 'Lagos', createdAt: now },
      demo_wh_ondo: { id: 'demo_wh_ondo', companyId: DEMO_COMPANY_ID, name: 'Ondo Buying Centre', location: 'Akure, Ondo', createdAt: now },
    },
    suppliers: {
      demo_supplier_1: {
        id: 'demo_supplier_1', companyId: DEMO_COMPANY_ID, name: 'John Doe Farms', phone: '08012345678', location: 'Ondo State',
        bankName: '', accountNumber: '', accountName: '', previousBalance: 0, createdAt: now,
      },
      demo_supplier_2: {
        id: 'demo_supplier_2', companyId: DEMO_COMPANY_ID, name: 'Grace Cooperative', phone: '08087654321', location: 'Ogun State',
        bankName: '', accountNumber: '', accountName: '', previousBalance: 0, createdAt: now,
      },
    },
    buyers: {
      demo_buyer_1: { id: 'demo_buyer_1', companyId: DEMO_COMPANY_ID, name: 'Export Partners Ltd', phone: '08011112222', location: 'Lagos', previousBalance: 0, createdAt: now },
    },
    transactions: {
      demo_tx_1: {
        id: 'demo_tx_1', companyId: DEMO_COMPANY_ID, date: daysAgo(6), postingDate: daysAgo(6), type: 'PURCHASE', commodity: 'COCOA',
        supplierId: 'demo_supplier_1', warehouseId: 'demo_wh_main', grossWeight: 5000, netWeight: 5000, bags: 80, noOfBags: 80,
        pricePerKg: 2500, totalValue: 12_500_000, calculationMethod: 'DIRECT', deductions, referenceId: 'TX-DEMO01',
      },
      demo_tx_2: {
        id: 'demo_tx_2', companyId: DEMO_COMPANY_ID, date: daysAgo(3), postingDate: daysAgo(3), type: 'PURCHASE', commodity: 'CASHEW',
        supplierId: 'demo_supplier_2', warehouseId: 'demo_wh_ondo', grossWeight: 2000, netWeight: 2000, bags: 40, noOfBags: 40,
        pricePerKg: 1200, totalValue: 2_400_000, calculationMethod: 'DIRECT', deductions: { ...deductions, moistureBenchmark: 10, moistureActual: 10 }, referenceId: 'TX-DEMO02',
      },
    },
    journal: {
      demo_je_1: {
        id: 'demo_je_1', companyId: DEMO_COMPANY_ID, warehouseId: 'demo_wh_main', date: daysAgo(7), postingDate: daysAgo(7), type: 'INFLOW',
        category: 'CAPITAL', amount: 20_000_000, description: 'Opening capital (training data)', paymentMethod: 'BANK_TRANSFER', source: 'MANUAL',
      },
    },
    staff: {
      demo_staff_1: {
        id: 'demo_staff_1', companyId: DEMO_COMPANY_ID, name: 'Amaka Obi', role: 'ACCOUNT', phone: '08033334444', salary: 250000,
        allowances: 50000, joinedDate: now, status: 'ACTIVE', applyPAYE: true, applyPension: true, assignedWarehouseId: 'demo_wh_main',
      },
    },
  };
}

function load(): Store {
  if (memoryStore) return memoryStore;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    memoryStore = raw ? (JSON.parse(raw) as Store) : seed();
    if (!raw) persist();
  } catch {
    memoryStore = seed();
  }
  return memoryStore;
}

function persist(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryStore));
  } catch {
    // Storage full or unavailable: keep the in-memory copy for this session.
  }
}

function commit(mutator: (store: Store) => void): void {
  const store = load();
  mutator(store);
  persist();
  queueMicrotask(() => listeners.forEach(l => {
    try {
      l();
    } catch (e) {
      console.error('Demo store listener failed', e);
    }
  }));
}

export function resetDemoData(): void {
  memoryStore = seed();
  persist();
  listeners.forEach(l => l());
}

// ---------------------------------------------------------------------------
// firebase/app
// ---------------------------------------------------------------------------

export const initializeApp = (options: Json = {}, name = '[DEFAULT]') => ({ name, options });
export const getApps = (): any[] => [];

// ---------------------------------------------------------------------------
// firebase/auth (not available without configuration)
// ---------------------------------------------------------------------------

const notConfigured = async (..._args: unknown[]): Promise<never> => {
  throw Object.assign(new Error(NOT_CONFIGURED), { code: 'auth/not-configured' });
};

export const getAuth = (_app?: unknown) => ({ currentUser: null });
export const onAuthStateChanged = (_auth: unknown, callback: (user: null) => void) => {
  setTimeout(() => callback(null), 0);
  return () => undefined;
};
export const signInWithPopup = notConfigured;
export const signInWithEmailAndPassword = notConfigured;
export const createUserWithEmailAndPassword = notConfigured;
export const sendPasswordResetEmail = notConfigured;
export const sendEmailVerification = notConfigured;
export const updatePassword = notConfigured;
export const reauthenticateWithCredential = notConfigured;
export const reload = notConfigured;
export const updateProfile = notConfigured;
export const signOut = async (_auth?: unknown) => undefined;
export const signInAnonymously = notConfigured;
export class GoogleAuthProvider {
  static PROVIDER_ID = 'google.com';
  setCustomParameters() {
    return this;
  }
}
export class EmailAuthProvider {
  static PROVIDER_ID = 'password';
  static credential(email: string, password: string) {
    return { providerId: 'password', email, password };
  }
}
export type User = any;

// ---------------------------------------------------------------------------
// firebase/firestore
// ---------------------------------------------------------------------------

const MOCK_DB = { type: 'mock-firestore' };
export const getFirestore = (..._args: unknown[]) => MOCK_DB;
export const initializeFirestore = (..._args: unknown[]) => MOCK_DB;

interface MockCollectionRef { type: 'collection'; path: string; id: string }
interface MockDocRef { type: 'document'; path: string; collectionPath: string; id: string }
interface Constraint { type: 'where' | 'orderBy' | 'limit' | 'startAfter'; field?: string; op?: string; value?: any; direction?: 'asc' | 'desc' }
interface MockQuery { type: 'query'; collectionPath: string; constraints: Constraint[] }

const SERVER_TIMESTAMP = '__serverTimestamp__';

function joinPath(segments: unknown[]): string {
  return segments.filter(s => typeof s === 'string' && s.length > 0).join('/');
}

export function collection(_parent: unknown, ...segments: string[]): MockCollectionRef {
  const base = _parent && typeof _parent === 'object' && (_parent as MockDocRef).type === 'document' ? (_parent as MockDocRef).path : '';
  const path = joinPath([base, ...segments]);
  return { type: 'collection', path, id: path.split('/').pop() || '' };
}

export function doc(parent: any, ...segments: string[]): MockDocRef {
  let path: string;
  if (parent && parent.type === 'collection') {
    path = joinPath([parent.path, segments[0] || crypto.randomUUID()]);
  } else {
    path = joinPath(segments);
  }
  const parts = path.split('/');
  const id = parts.pop() as string;
  return { type: 'document', path, collectionPath: parts.join('/'), id };
}

export const where = (field: string, op: string, value: any): Constraint => ({ type: 'where', field, op, value });
export const orderBy = (field: string, direction: 'asc' | 'desc' = 'asc'): Constraint => ({ type: 'orderBy', field, direction });
export const limit = (value: number): Constraint => ({ type: 'limit', value });
export const startAfter = (value: any): Constraint => ({ type: 'startAfter', value });
export const documentId = () => '__name__';

export function query(base: MockCollectionRef | MockQuery, ...constraints: Constraint[]): MockQuery {
  if (base.type === 'query') return { ...base, constraints: [...base.constraints, ...constraints] };
  return { type: 'query', collectionPath: base.path, constraints };
}

export const serverTimestamp = () => SERVER_TIMESTAMP;
export const arrayUnion = (...values: any[]) => ({ __op: 'arrayUnion', values });
export const increment = (n: number) => ({ __op: 'increment', n });

function readField(data: Json, field: string): any {
  if (field === '__name__') return data.__id;
  return field.split('.').reduce((acc: any, key) => (acc == null ? undefined : acc[key]), data);
}

function matches(data: Json, c: Constraint): boolean {
  const v = readField(data, c.field as string);
  switch (c.op) {
    case '==': return v === c.value;
    case '!=': return v !== c.value;
    case '<': return v < c.value;
    case '<=': return v <= c.value;
    case '>': return v > c.value;
    case '>=': return v >= c.value;
    case 'in': return Array.isArray(c.value) && c.value.includes(v);
    case 'not-in': return Array.isArray(c.value) && !c.value.includes(v);
    case 'array-contains': return Array.isArray(v) && v.includes(c.value);
    default: return true;
  }
}

function resolveValue(existing: any, incoming: any): any {
  if (incoming === SERVER_TIMESTAMP) return new Date().toISOString();
  if (incoming && typeof incoming === 'object' && incoming.__op === 'arrayUnion') {
    const current = Array.isArray(existing) ? existing : [];
    return [...current, ...incoming.values.filter((v: any) => !current.includes(v))];
  }
  if (incoming && typeof incoming === 'object' && incoming.__op === 'increment') {
    return (typeof existing === 'number' ? existing : 0) + incoming.n;
  }
  if (Array.isArray(incoming)) return incoming.map(v => resolveValue(undefined, v));
  if (incoming && typeof incoming === 'object') {
    const out: Json = {};
    for (const [k, v] of Object.entries(incoming)) {
      if (v !== undefined) out[k] = resolveValue(existing?.[k], v);
    }
    return out;
  }
  return incoming;
}

function snapshotOf(ref: MockDocRef, data: Json | undefined) {
  const copy = data ? JSON.parse(JSON.stringify(data)) : undefined;
  return {
    id: ref.id,
    ref,
    exists: () => copy !== undefined,
    data: () => (copy ? { ...copy } : undefined),
    get: (field: string) => (copy ? readField(copy, field) : undefined),
    metadata: { hasPendingWrites: false, fromCache: false },
  };
}

function runQuery(q: MockQuery | MockCollectionRef) {
  const collectionPath = q.type === 'query' ? q.collectionPath : q.path;
  const constraints = q.type === 'query' ? q.constraints : [];
  const rows = Object.entries(load()[collectionPath] || {}).map(([id, data]) => ({ ...data, __id: id }));
  let list = rows.filter(row => constraints.filter(c => c.type === 'where').every(c => matches(row, c)));
  for (const order of constraints.filter(c => c.type === 'orderBy').reverse()) {
    const dir = order.direction === 'desc' ? -1 : 1;
    list.sort((a, b) => {
      const va = readField(a, order.field as string);
      const vb = readField(b, order.field as string);
      if (va === vb) return 0;
      if (va === undefined) return 1;
      if (vb === undefined) return -1;
      return (va < vb ? -1 : 1) * dir;
    });
  }
  const after = constraints.find(c => c.type === 'startAfter');
  if (after?.value) {
    const afterId = after.value.id ?? after.value;
    const index = list.findIndex(row => row.__id === afterId);
    if (index >= 0) list = list.slice(index + 1);
  }
  const lim = constraints.find(c => c.type === 'limit');
  if (lim) list = list.slice(0, lim.value);
  const docs = list.map(row => {
    const { __id, ...data } = row;
    return snapshotOf({ type: 'document', path: `${collectionPath}/${__id}`, collectionPath, id: __id }, data);
  });
  return { docs, empty: docs.length === 0, size: docs.length, forEach: (fn: (d: any) => void) => docs.forEach(fn), metadata: { fromCache: false } };
}

export async function getDoc(ref: MockDocRef) {
  return snapshotOf(ref, load()[ref.collectionPath]?.[ref.id]);
}
export const getDocFromServer = getDoc;

export async function getDocs(q: MockQuery | MockCollectionRef) {
  return runQuery(q);
}

function applySet(store: Store, ref: MockDocRef, data: Json, options?: { merge?: boolean }) {
  store[ref.collectionPath] = store[ref.collectionPath] || {};
  const existing = store[ref.collectionPath][ref.id];
  store[ref.collectionPath][ref.id] = options?.merge ? { ...(existing || {}), ...resolveValue(existing, data) } : resolveValue(undefined, data);
}

function applyUpdate(store: Store, ref: MockDocRef, data: Json) {
  const existing = store[ref.collectionPath]?.[ref.id];
  if (!existing) throw Object.assign(new Error(`No document to update: ${ref.path}`), { code: 'not-found' });
  store[ref.collectionPath][ref.id] = { ...existing, ...resolveValue(existing, data) };
}

function applyDelete(store: Store, ref: MockDocRef) {
  if (store[ref.collectionPath]) delete store[ref.collectionPath][ref.id];
}

export async function setDoc(ref: MockDocRef, data: Json, options?: { merge?: boolean }) {
  commit(store => applySet(store, ref, data, options));
}

export async function updateDoc(ref: MockDocRef, data: Json) {
  commit(store => applyUpdate(store, ref, data));
}

export async function deleteDoc(ref: MockDocRef) {
  commit(store => applyDelete(store, ref));
}

export async function addDoc(collectionRef: MockCollectionRef, data: Json) {
  const ref = doc(collectionRef);
  await setDoc(ref, data);
  return ref;
}

type PendingOp = (store: Store) => void;

export function writeBatch(_db?: unknown) {
  const ops: PendingOp[] = [];
  const batch = {
    set(ref: MockDocRef, data: Json, options?: { merge?: boolean }) {
      ops.push(store => applySet(store, ref, data, options));
      return batch;
    },
    update(ref: MockDocRef, data: Json) {
      ops.push(store => applyUpdate(store, ref, data));
      return batch;
    },
    delete(ref: MockDocRef) {
      ops.push(store => applyDelete(store, ref));
      return batch;
    },
    async commit() {
      // Validate against a copy first so a failing op leaves the store untouched (atomic).
      const draft: Store = JSON.parse(JSON.stringify(load()));
      ops.forEach(op => op(draft));
      commit(store => {
        Object.keys(store).forEach(k => delete store[k]);
        Object.assign(store, draft);
      });
    },
  };
  return batch;
}

export async function runTransaction<T>(_db: unknown, updateFunction: (tx: any) => Promise<T>): Promise<T> {
  const draft: Store = JSON.parse(JSON.stringify(load()));
  const tx = {
    get: async (ref: MockDocRef) => snapshotOf(ref, draft[ref.collectionPath]?.[ref.id]),
    set(ref: MockDocRef, data: Json, options?: { merge?: boolean }) {
      applySet(draft, ref, data, options);
      return tx;
    },
    update(ref: MockDocRef, data: Json) {
      applyUpdate(draft, ref, data);
      return tx;
    },
    delete(ref: MockDocRef) {
      applyDelete(draft, ref);
      return tx;
    },
  };
  const result = await updateFunction(tx);
  commit(store => {
    Object.keys(store).forEach(k => delete store[k]);
    Object.assign(store, draft);
  });
  return result;
}

export function onSnapshot(target: MockDocRef | MockQuery | MockCollectionRef, onNext: (snap: any) => void, onError?: (e: Error) => void) {
  const run = () => {
    try {
      if (target.type === 'document') {
        onNext(snapshotOf(target, load()[target.collectionPath]?.[target.id]));
      } else {
        onNext(runQuery(target));
      }
    } catch (e) {
      if (onError) onError(e as Error);
      else console.error('Demo snapshot failed', e);
    }
  };
  listeners.add(run);
  setTimeout(run, 0);
  return () => {
    listeners.delete(run);
  };
}
