/**
 * All data changes go through commitWrites so that:
 *  - related documents (record + audit log + linked journal lines) are written atomically;
 *  - stock, bag and petty-cash balances are checked inside a Firestore transaction, so two
 *    users cannot overdraw the same balance at the same time;
 *  - state preconditions (e.g. "still PENDING") are re-checked on the server copy before writing;
 *  - nothing is attempted while offline (the app has no offline persistence, so an
 *    "optimistic" write would silently disappear on reload).
 */

import { db } from '../firebase';
import { doc, runTransaction, serverTimestamp, writeBatch } from './fs';
import type { FirestoreTransaction, WriteBatch } from './fs';
import { InsufficientBalanceError, OfflineError, ValidationError } from './firestore';
import { parseStockKey } from './finance';
import { roundTo, stripUndefined } from './utils';

export type WriteOp =
  | { kind: 'set'; collection: string; id: string; data: Record<string, unknown>; merge?: boolean }
  | { kind: 'update'; collection: string; id: string; data: Record<string, unknown> }
  | { kind: 'delete'; collection: string; id: string };

export interface BalanceGuard {
  companyId: string;
  /** stockKey -> signed change */
  deltas: Record<string, number>;
  /** Balances derived from history, used to initialise a counter that does not exist yet. */
  derivedLevels: Record<string, number>;
  /** Turns a stock key into a human-readable label for error messages. */
  describeKey?: (key: string) => string;
}

/** A field value that must still hold on the server when the write commits. */
export interface Precondition {
  collection: string;
  id: string;
  field: string;
  equals: unknown;
  message: string;
}

const EPSILON = 0.005;

export function stockBalanceDocId(companyId: string, key: string): string {
  const { ledger, warehouseId, item } = parseStockKey(key);
  return [companyId, ledger, warehouseId || 'NONE', encodeURIComponent(item)].join('~');
}

export function assertOnline(): void {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new OfflineError();
  }
}

function prepare(op: WriteOp): WriteOp {
  return op.kind === 'delete' ? op : { ...op, data: stripUndefined(op.data) };
}

function apply(target: WriteBatch | FirestoreTransaction, op: WriteOp): void {
  const ref = doc(db, op.collection, op.id);
  if (op.kind === 'set') {
    if (op.merge) (target as WriteBatch).set(ref, op.data, { merge: true });
    else (target as WriteBatch).set(ref, op.data);
  } else if (op.kind === 'update') {
    (target as WriteBatch).update(ref, op.data);
  } else {
    (target as WriteBatch).delete(ref);
  }
}

export async function commitWrites(ops: WriteOp[], guard?: BalanceGuard, preconditions: Precondition[] = []): Promise<void> {
  assertOnline();
  const prepared = ops.map(prepare);
  const guardedKeys = guard ? Object.keys(guard.deltas).filter(key => Math.abs(guard.deltas[key]) >= EPSILON) : [];

  if (guardedKeys.length === 0 && preconditions.length === 0) {
    if (prepared.length === 0) return;
    const batch = writeBatch(db);
    prepared.forEach(op => apply(batch, op));
    await batch.commit();
    return;
  }

  await runTransaction(db, async tx => {
    // Firestore transactions require all reads before any writes.
    const conditionSnaps = await Promise.all(preconditions.map(p => tx.get(doc(db, p.collection, p.id))));
    const balanceRefs = guard ? guardedKeys.map(key => ({ key, ref: doc(db, 'stock_balances', stockBalanceDocId(guard.companyId, key)) })) : [];
    const balanceSnaps = await Promise.all(balanceRefs.map(({ ref }) => tx.get(ref)));

    preconditions.forEach((p, index) => {
      const snap = conditionSnaps[index];
      const actual = snap.exists() ? (snap.data() as Record<string, unknown>)[p.field] : undefined;
      if (actual !== p.equals) throw new ValidationError(p.message);
    });

    if (guard) {
      balanceRefs.forEach(({ key, ref }, index) => {
        const snap = balanceSnaps[index];
        const stored = snap.exists() ? Number((snap.data() as { quantity?: unknown }).quantity) : NaN;
        const base = Number.isFinite(stored) ? stored : guard.derivedLevels[key] || 0;
        const delta = guard.deltas[key];
        const next = roundTo(base + delta, 2);
        if (delta < 0 && next < -EPSILON) {
          const label = guard.describeKey ? guard.describeKey(key) : key;
          throw new InsufficientBalanceError(
            `Insufficient balance for ${label}. Available: ${roundTo(Math.max(0, base), 2).toLocaleString()}, required: ${roundTo(-delta, 2).toLocaleString()}.`
          );
        }
        const { ledger, warehouseId, item } = parseStockKey(key);
        tx.set(ref, {
          id: ref.id,
          companyId: guard.companyId,
          ledger,
          warehouseId,
          item,
          quantity: next,
          updatedAt: serverTimestamp(),
        });
      });
    }

    prepared.forEach(op => apply(tx, op));
  });
}

/** Overwrites balance counters with values recomputed from history (admin repair tool). */
export async function rebuildBalanceCounters(companyId: string, levels: Record<string, number>, existingIds: string[]): Promise<void> {
  assertOnline();
  const ops: WriteOp[] = [];
  const keep = new Set<string>();
  for (const [key, quantity] of Object.entries(levels)) {
    const id = stockBalanceDocId(companyId, key);
    keep.add(id);
    const { ledger, warehouseId, item } = parseStockKey(key);
    ops.push({ kind: 'set', collection: 'stock_balances', id, data: { id, companyId, ledger, warehouseId, item, quantity: roundTo(quantity, 2), updatedAt: serverTimestamp() } });
  }
  for (const id of existingIds) {
    if (!keep.has(id)) {
      const [, ledger = 'COMMODITY', warehouseId = 'NONE', item = ''] = id.split('~');
      ops.push({
        kind: 'set',
        collection: 'stock_balances',
        id,
        data: { id, companyId, ledger, warehouseId: warehouseId === 'NONE' ? '' : warehouseId, item: decodeURIComponent(item), quantity: 0, updatedAt: serverTimestamp() },
      });
    }
  }
  // Firestore batches are limited to 500 operations.
  for (let i = 0; i < ops.length; i += 450) {
    await commitWrites(ops.slice(i, i + 450));
  }
}
