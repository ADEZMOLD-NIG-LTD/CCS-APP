/**
 * Shared, company-scoped Firestore subscriptions.
 *
 * Each collection is subscribed once per session (the first time any screen needs it) and
 * shared by every module, instead of every module opening its own listeners and re-reading
 * the whole collection on each navigation.
 */

import React, { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, where } from '../lib/fs';
import { reportFirestoreError, OperationType } from '../lib/firestore';
import { computeStockLevels, type StockSources } from '../lib/finance';
import { useAuth } from './AuthContext';
import type {
  Attendance,
  BagTransaction,
  Buyer,
  InventoryAdjustment,
  JournalEntry,
  Payment,
  Payroll,
  PettyCashTransaction,
  Roster,
  Staff,
  StockBalance,
  StoreRecord,
  Supplier,
  Transaction,
  Warehouse,
} from '../types';

export interface CompanyCollections {
  suppliers: Supplier;
  buyers: Buyer;
  warehouses: Warehouse;
  transactions: Transaction;
  payments: Payment;
  journal: JournalEntry;
  bag_transactions: BagTransaction;
  inventory_adjustments: InventoryAdjustment;
  store_records: StoreRecord;
  petty_cash: PettyCashTransaction;
  staff: Staff;
  attendance: Attendance;
  rosters: Roster;
  payrolls: Payroll;
  stock_balances: StockBalance;
}

export type CompanyCollectionName = keyof CompanyCollections;

export interface CollectionState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
}

const EMPTY: CollectionState<never> = Object.freeze({ data: [], loading: true, error: null }) as CollectionState<never>;
const IDLE: CollectionState<never> = Object.freeze({ data: [], loading: false, error: null }) as CollectionState<never>;

class CompanyDataStore {
  private entries = new Map<string, CollectionState<unknown>>();
  private unsubscribers = new Map<string, () => void>();
  private listeners = new Set<() => void>();

  constructor(private readonly companyId: string | null) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  get(name: string): CollectionState<unknown> {
    if (!this.companyId) return IDLE;
    return this.entries.get(name) ?? EMPTY;
  }

  ensure(name: CompanyCollectionName): void {
    if (!this.companyId || this.unsubscribers.has(name)) return;
    const q = query(collection(db, name), where('companyId', '==', this.companyId));
    const unsubscribe = onSnapshot(
      q,
      snapshot => {
        const data = snapshot.docs.map(d => ({ ...(d.data() as object), id: d.id }));
        this.entries.set(name, { data, loading: false, error: null });
        this.emit();
      },
      error => {
        this.entries.set(name, { data: this.entries.get(name)?.data ?? [], loading: false, error: reportFirestoreError(error, OperationType.LIST, name) });
        this.emit();
      }
    );
    this.unsubscribers.set(name, unsubscribe);
  }

  dispose(): void {
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
    this.unsubscribers.clear();
    this.entries.clear();
    this.listeners.clear();
  }

  private emit(): void {
    this.listeners.forEach(listener => listener());
  }
}

const StoreContext = createContext<CompanyDataStore | null>(null);

export function CompanyDataProvider({ children }: { children: React.ReactNode }) {
  const { profile, accessState } = useAuth();
  const companyId = accessState === 'READY' && profile?.companyId ? profile.companyId : null;
  const store = useMemo(() => new CompanyDataStore(companyId), [companyId]);

  useEffect(() => () => store.dispose(), [store]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

const noopSubscribe = () => () => undefined;

export function useCompanyCollection<K extends CompanyCollectionName>(name: K, enabled = true): CollectionState<CompanyCollections[K]> {
  const store = useContext(StoreContext);

  useEffect(() => {
    if (enabled) store?.ensure(name);
  }, [store, name, enabled]);

  const state = useSyncExternalStore(
    store && enabled ? store.subscribe : noopSubscribe,
    () => (store && enabled ? store.get(name) : IDLE)
  );
  return state as CollectionState<CompanyCollections[K]>;
}

/** Same as useCompanyCollection but without soft-deleted documents. */
export function useActiveCollection<K extends CompanyCollectionName>(name: K, enabled = true): CollectionState<CompanyCollections[K]> {
  const state = useCompanyCollection(name, enabled);
  const data = useMemo(
    () => state.data.filter(item => !(item as { isDeleted?: boolean }).isDeleted),
    [state.data]
  );
  return useMemo(() => ({ ...state, data }), [state, data]);
}

export function useWarehouses(): CollectionState<Warehouse> {
  const state = useActiveCollection('warehouses');
  const data = useMemo(() => [...state.data].sort((a, b) => (a.name || '').localeCompare(b.name || '')), [state.data]);
  return useMemo(() => ({ ...state, data }), [state, data]);
}

interface StockLevelOptions {
  commodities?: boolean;
  bags?: boolean;
  store?: boolean;
  pettyCash?: boolean;
}

/** Stock/bag/store/petty-cash balances derived from history (the values shown on screen). */
export function useDerivedLevels(options: StockLevelOptions) {
  const transactions = useCompanyCollection('transactions', !!options.commodities);
  const adjustments = useCompanyCollection('inventory_adjustments', !!options.commodities);
  const bags = useCompanyCollection('bag_transactions', !!options.bags);
  const storeRecords = useCompanyCollection('store_records', !!options.store);
  const pettyCash = useCompanyCollection('petty_cash', !!options.pettyCash);

  const loading = transactions.loading || adjustments.loading || bags.loading || storeRecords.loading || pettyCash.loading;

  const levels = useMemo(() => {
    const sources: StockSources = {};
    if (options.commodities) {
      sources.transactions = transactions.data;
      sources.adjustments = adjustments.data;
    }
    if (options.bags) sources.bagTransactions = bags.data;
    if (options.store) sources.storeRecords = storeRecords.data;
    if (options.pettyCash) sources.pettyCash = pettyCash.data;
    return computeStockLevels(sources);
  }, [options.commodities, options.bags, options.store, options.pettyCash, transactions.data, adjustments.data, bags.data, storeRecords.data, pettyCash.data]);

  return { levels, loading };
}
