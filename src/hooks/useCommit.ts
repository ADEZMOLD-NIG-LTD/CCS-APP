import { useCallback, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useWarehouses } from '../contexts/CompanyDataContext';
import { commitWrites, type BalanceGuard, type Precondition, type WriteOp } from '../lib/writes';
import { OperationType, reportFirestoreError } from '../lib/firestore';
import { parseStockKey } from '../lib/finance';

interface CommitOptions {
  guard?: BalanceGuard;
  preconditions?: Precondition[];
  success?: string;
  context?: string;
}

/**
 * Wraps commitWrites with a busy flag (prevents double submission) and global toasts.
 * Resolves to true when the write succeeded.
 */
export function useCommit() {
  const { setErrorMessage, setSuccessMessage } = useAuth();
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const commit = useCallback(async (ops: WriteOp[], options: CommitOptions = {}): Promise<boolean> => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    try {
      await commitWrites(ops, options.guard, options.preconditions);
      if (options.success) setSuccessMessage(options.success);
      return true;
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, OperationType.WRITE, options.context ?? null));
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [setErrorMessage, setSuccessMessage]);

  return { commit, busy };
}

/** Builds balance guards with readable error labels ("COCOA at Main Warehouse"). */
export function useBalanceGuard(derivedLevels: Record<string, number>) {
  const { profile } = useAuth();
  const { data: warehouses } = useWarehouses();

  return useCallback((deltas: Record<string, number>): BalanceGuard => ({
    companyId: profile?.companyId ?? '',
    deltas,
    derivedLevels,
    describeKey: (key: string) => {
      const { ledger, warehouseId, item } = parseStockKey(key);
      const warehouse = warehouses.find(w => w.id === warehouseId)?.name || 'an unassigned warehouse';
      if (ledger === 'PETTY_CASH') return `petty cash at ${warehouse} (₦)`;
      if (ledger === 'BAG') return `${item.replace('_', ' ').toLowerCase()}s at ${warehouse}`;
      if (ledger === 'STORE') return `${item} (store records) at ${warehouse} (kg)`;
      return `${item} at ${warehouse} (kg)`;
    },
  }), [profile?.companyId, derivedLevels, warehouses]);
}
