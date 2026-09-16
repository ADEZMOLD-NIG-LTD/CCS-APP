/**
 * Firestore facade. Components import Firestore functions from here instead of
 * 'firebase/firestore' so demo mode is transparently served by the local backend and can
 * never write to production.
 */

import * as firestore from 'firebase/firestore';
import * as localBackend from '../mockFirebase';
import { isDemoRuntime } from './runtimeMode';

const impl = (isDemoRuntime ? localBackend : firestore) as unknown as typeof firestore;

export const collection = impl.collection;
export const doc = impl.doc;
export const query = impl.query;
export const where = impl.where;
export const orderBy = impl.orderBy;
export const limit = impl.limit;
export const startAfter = impl.startAfter;
export const onSnapshot = impl.onSnapshot;
export const getDoc = impl.getDoc;
export const getDocs = impl.getDocs;
export const setDoc = impl.setDoc;
export const updateDoc = impl.updateDoc;
export const deleteDoc = impl.deleteDoc;
export const writeBatch = impl.writeBatch;
export const runTransaction = impl.runTransaction;
export const serverTimestamp = impl.serverTimestamp;

export type {
  DocumentData,
  DocumentReference,
  DocumentSnapshot,
  QueryConstraint,
  QueryDocumentSnapshot,
  Transaction as FirestoreTransaction,
  Unsubscribe,
  WriteBatch,
} from 'firebase/firestore';
