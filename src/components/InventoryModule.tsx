/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, Plus, Wrench } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useActiveCollection, useCompanyCollection, useDerivedLevels, useWarehouses } from '../contexts/CompanyDataContext';
import { useBalanceGuard, useCommit } from '../hooks/useCommit';
import { AuditAction, auditOp } from '../lib/audit';
import {
  adjustmentStockEffects, bagStockEffects, diffEffects, levelFor, levelsByItem, parseStockKey, transactionStockEffects,
} from '../lib/finance';
import { localDateToIso } from '../lib/dates';
import { rebuildBalanceCounters, type WriteOp } from '../lib/writes';
import { formatFirestoreError } from '../lib/firestore';
import { cn, newId } from '../lib/utils';
import type { BagTransaction, InventoryAdjustment, PackagingType, Supplier, Transaction } from '../types';
import PurchaseForm, { type PurchaseInput } from './inventory/PurchaseForm';
import BagTransactionForm, { type BagTransactionInput } from './inventory/BagTransactionForm';
import BagTransferForm, { type BagTransferInput } from './inventory/BagTransferForm';
import StockTransferForm, { type StockTransferInput } from './inventory/StockTransferForm';
import InventoryStats from './inventory/InventoryStats';
import TransactionList from './inventory/TransactionList';
import AdjustmentForm, { type AdjustmentInput } from './inventory/AdjustmentForm';
import AdjustmentLedger from './inventory/AdjustmentLedger';
import ConfirmModal from './ConfirmModal';

type Tab = 'COMMODITIES' | 'PACKAGING' | 'ADJUSTMENTS';
type Panel = null | 'purchase' | 'transfer' | 'bag' | 'bagTransfer' | 'adjustment';

export default function InventoryModule({ startWithPurchase = false }: { startWithPurchase?: boolean }) {
  const { profile, role, can, auditActor, setErrorMessage, setSuccessMessage } = useAuth();
  const { commit, busy } = useCommit();
  const txState = useCompanyCollection('transactions');
  const adjustmentState = useCompanyCollection('inventory_adjustments');
  const bagState = useCompanyCollection('bag_transactions');
  const suppliers = useActiveCollection('suppliers').data;
  const { data: warehouses } = useWarehouses();
  const counters = useCompanyCollection('stock_balances', role === 'ADMIN');
  const { levels } = useDerivedLevels({ commodities: true, bags: true });
  const guardFor = useBalanceGuard(levels);

  const [tab, setTab] = useState<Tab>('COMMODITIES');
  const [panel, setPanel] = useState<Panel>(startWithPurchase && can('create_trade') ? 'purchase' : null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editingAdjustment, setEditingAdjustment] = useState<InventoryAdjustment | null>(null);
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);
  const [deletingAdjustment, setDeletingAdjustment] = useState<InventoryAdjustment | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(profile?.assignedWarehouseId || 'ALL');
  const [rebuilding, setRebuilding] = useState(false);

  const purchases = useMemo(
    () => txState.data
      .filter(t => t.type === 'PURCHASE' && !t.isDeleted && (selectedWarehouseId === 'ALL' || t.warehouseId === selectedWarehouseId))
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()),
    [txState.data, selectedWarehouseId]
  );
  const bags = useMemo(
    () => bagState.data
      .filter(b => !b.isDeleted && (selectedWarehouseId === 'ALL' || b.warehouseId === selectedWarehouseId || b.sourceWarehouseId === selectedWarehouseId || b.destinationWarehouseId === selectedWarehouseId))
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()),
    [bagState.data, selectedWarehouseId]
  );
  const adjustments = useMemo(
    () => adjustmentState.data
      .filter(a => !a.isDeleted && (selectedWarehouseId === 'ALL' || a.warehouseId === selectedWarehouseId))
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()),
    [adjustmentState.data, selectedWarehouseId]
  );

  const commodityStock = useMemo(() => levelsByItem(levels, 'COMMODITY', selectedWarehouseId), [levels, selectedWarehouseId]);
  const bagStock = useMemo(() => levelsByItem(levels, 'BAG', selectedWarehouseId) as Record<PackagingType, number>, [levels, selectedWarehouseId]);

  // Counters that disagree with the history-derived balance (e.g. after legacy writes).
  const driftCount = useMemo(() => {
    if (role !== 'ADMIN' || counters.loading) return 0;
    let drift = 0;
    for (const counter of counters.data) {
      if (counter.ledger !== 'COMMODITY' && counter.ledger !== 'BAG') continue;
      const key = `${counter.ledger}|${counter.warehouseId === 'NONE' ? '' : counter.warehouseId}|${counter.item}`;
      if (Math.abs((levels[key] || 0) - (counter.quantity || 0)) > 0.01) drift++;
    }
    return drift;
  }, [role, counters, levels]);

  if (!auditActor) return null;
  const actor = auditActor;
  const companyId = actor.companyId;
  const nowIso = () => new Date().toISOString();
  const closePanels = () => {
    setPanel(null);
    setEditingTx(null);
    setEditingAdjustment(null);
  };

  // ------------------------------------------------------------ purchases

  const savePurchase = async (input: PurchaseInput) => {
    const before = editingTx;
    const ops: WriteOp[] = [];
    let supplierId = input.supplierId;

    if (input.isWalkIn) {
      supplierId = `WALK_IN_${companyId}`;
      if (!suppliers.some(s => s.id === supplierId)) {
        const walkIn: Supplier = {
          id: supplierId, companyId, name: 'Walk-in Supplier (General)', phone: 'N/A', location: 'N/A',
          bankName: '', accountNumber: '', accountName: '', previousBalance: 0, createdAt: nowIso(),
        };
        ops.push({ kind: 'set', collection: 'suppliers', id: supplierId, data: { ...walkIn } });
      }
    }

    const id = before?.id ?? newId();
    const record: Transaction = {
      ...(before ?? {}),
      id,
      companyId,
      date: localDateToIso(input.date, before?.date),
      postingDate: before?.postingDate ?? nowIso(),
      type: 'PURCHASE',
      commodity: input.commodity,
      calculationMethod: input.calculationMethod,
      supplierId,
      storeRecordId: input.storeRecordId || undefined,
      warehouseId: input.warehouseId,
      grossWeight: input.grossWeight,
      netWeight: input.netWeight,
      bags: input.bags,
      noOfBags: input.bags,
      pricePerKg: input.pricePerKg,
      totalValue: input.totalValue,
      referenceId: before?.referenceId ?? `TX-${id.slice(0, 8).toUpperCase()}`,
      deductions: input.deductions,
      createdByUid: before?.createdByUid ?? actor.uid,
      ...(before ? { updatedAt: nowIso(), updatedByUid: actor.uid } : {}),
    };

    ops.push({ kind: 'set', collection: 'transactions', id, data: { ...record } });
    ops.push(auditOp(actor, {
      action: before ? AuditAction.UPDATE : AuditAction.CREATE,
      module: 'Inventory (Purchase)',
      recordId: id,
      details: `${before ? 'Adjusted' : 'Recorded'} purchase ${record.referenceId}: ${record.netWeight}kg ${record.commodity}`,
      previousData: before,
      newData: record,
    }));

    const deltas = diffEffects(transactionStockEffects(before), transactionStockEffects(record));
    const ok = await commit(ops, { guard: guardFor(deltas), success: before ? 'Purchase updated.' : 'Purchase recorded.', context: 'transactions' });
    if (ok) closePanels();
  };

  const deletePurchase = async (reason?: string) => {
    const tx = deletingTx;
    if (!tx || !reason?.trim()) return;
    const deletion = { isDeleted: true, deletionReason: reason.trim(), deletedBy: actor.email, deletedByUid: actor.uid, deletedAt: nowIso() };
    const deltas = diffEffects(transactionStockEffects(tx), []);
    const ok = await commit(
      [
        { kind: 'update', collection: 'transactions', id: tx.id, data: deletion },
        auditOp(actor, { action: AuditAction.DELETE, module: 'Inventory (Purchase)', recordId: tx.id, details: `Deleted purchase ${tx.referenceId}. Reason: ${reason.trim()}`, previousData: tx }),
      ],
      { guard: guardFor(deltas), success: 'Purchase deleted.', context: 'transactions' }
    );
    if (ok) setDeletingTx(null);
  };

  // ------------------------------------------------------------ transfers

  const saveTransfer = async (input: StockTransferInput) => {
    const id = newId();
    const record: Transaction = {
      id,
      companyId,
      date: localDateToIso(input.date),
      postingDate: nowIso(),
      type: 'TRANSFER',
      commodity: input.commodity,
      sourceWarehouseId: input.sourceWarehouseId,
      destinationWarehouseId: input.destinationWarehouseId,
      grossWeight: input.weight,
      netWeight: input.weight,
      bags: input.bags,
      noOfBags: input.bags,
      referenceId: `TR-${id.slice(0, 8).toUpperCase()}`,
      deductions: { moistureActual: 0, moistureBenchmark: 0, tareWeight: 0, moldWeight: 0, otherDeduction: 0 },
      createdByUid: actor.uid,
    };
    const from = warehouses.find(w => w.id === input.sourceWarehouseId)?.name;
    const to = warehouses.find(w => w.id === input.destinationWarehouseId)?.name;
    const ok = await commit(
      [
        { kind: 'set', collection: 'transactions', id, data: { ...record } },
        auditOp(actor, { action: AuditAction.CREATE, module: 'Inventory (Transfer)', recordId: id, details: `Transferred ${input.weight}kg ${input.commodity} from ${from} to ${to}`, newData: record }),
      ],
      { guard: guardFor(diffEffects([], transactionStockEffects(record))), success: 'Stock transferred.', context: 'transactions' }
    );
    if (ok) closePanels();
  };

  // ------------------------------------------------------------ bags

  const saveBagTransaction = async (input: BagTransactionInput) => {
    const id = newId();
    const record: BagTransaction = {
      id,
      companyId,
      date: nowIso(),
      type: input.type,
      packagingType: input.packagingType,
      quantity: input.quantity,
      reference: input.reference || `BAG-${id.slice(0, 8).toUpperCase()}`,
      warehouseId: input.warehouseId,
      supplierId: input.supplierId || undefined,
      createdByUid: actor.uid,
    };
    const ok = await commit(
      [
        { kind: 'set', collection: 'bag_transactions', id, data: { ...record } },
        auditOp(actor, { action: AuditAction.CREATE, module: 'Inventory (Bags)', recordId: id, details: `${input.type.replace('_', ' ')}: ${input.quantity} ${input.packagingType.replace('_', ' ')}`, newData: record }),
      ],
      { guard: guardFor(diffEffects([], bagStockEffects(record))), success: 'Bag movement recorded.', context: 'bag_transactions' }
    );
    if (ok) closePanels();
  };

  const saveBagTransfer = async (input: BagTransferInput) => {
    const id = newId();
    const record: BagTransaction = {
      id,
      companyId,
      date: nowIso(),
      type: 'TRANSFER',
      packagingType: input.packagingType,
      quantity: input.quantity,
      reference: input.reference || `BTR-${id.slice(0, 8).toUpperCase()}`,
      sourceWarehouseId: input.sourceWarehouseId,
      destinationWarehouseId: input.destinationWarehouseId,
      createdByUid: actor.uid,
    };
    const ok = await commit(
      [
        { kind: 'set', collection: 'bag_transactions', id, data: { ...record } },
        auditOp(actor, { action: AuditAction.CREATE, module: 'Inventory (Bag Transfer)', recordId: id, details: `Transferred ${input.quantity} ${input.packagingType.replace('_', ' ')}`, newData: record }),
      ],
      { guard: guardFor(diffEffects([], bagStockEffects(record))), success: 'Bags transferred.', context: 'bag_transactions' }
    );
    if (ok) closePanels();
  };

  // ------------------------------------------------------------ adjustments

  const saveAdjustment = async (input: AdjustmentInput) => {
    const before = editingAdjustment;
    const id = before?.id ?? newId();
    const record: InventoryAdjustment = {
      ...(before ?? {}),
      id,
      companyId,
      date: localDateToIso(input.date, before?.date),
      postingDate: before?.postingDate ?? nowIso(),
      commodity: input.commodity,
      warehouseId: input.warehouseId,
      adjustmentType: input.adjustmentType,
      adjustmentDirection: input.adjustmentDirection,
      netWeight: input.netWeight,
      bags: input.bags,
      notes: input.notes,
      createdBy: before?.createdBy ?? actor.uid,
      creatorEmail: before?.creatorEmail ?? actor.email,
    };
    const deltas = diffEffects(adjustmentStockEffects(before), adjustmentStockEffects(record));
    const ok = await commit(
      [
        { kind: 'set', collection: 'inventory_adjustments', id, data: { ...record } },
        auditOp(actor, {
          action: before ? AuditAction.UPDATE : AuditAction.CREATE,
          module: 'Inventory (Adjustment)',
          recordId: id,
          details: `${before ? 'Updated' : 'Posted'} ${record.adjustmentDirection === 'ADD' ? '+' : '-'}${record.netWeight}kg ${record.commodity} (${record.adjustmentType})`,
          previousData: before,
          newData: record,
        }),
      ],
      { guard: guardFor(deltas), success: before ? 'Adjustment updated.' : 'Adjustment posted.', context: 'inventory_adjustments' }
    );
    if (ok) closePanels();
  };

  const deleteAdjustment = async (reason?: string) => {
    const adj = deletingAdjustment;
    if (!adj || !reason?.trim()) return;
    const ok = await commit(
      [
        { kind: 'update', collection: 'inventory_adjustments', id: adj.id, data: { isDeleted: true, deletionReason: reason.trim(), deletedBy: actor.email, deletedByUid: actor.uid, deletedAt: nowIso() } },
        auditOp(actor, { action: AuditAction.DELETE, module: 'Inventory (Adjustment)', recordId: adj.id, details: `Deleted adjustment of ${adj.netWeight}kg ${adj.commodity}. Reason: ${reason.trim()}`, previousData: adj }),
      ],
      { guard: guardFor(diffEffects(adjustmentStockEffects(adj), [])), success: 'Adjustment deleted.', context: 'inventory_adjustments' }
    );
    if (ok) setDeletingAdjustment(null);
  };

  const rebuildCounters = async () => {
    setRebuilding(true);
    try {
      const scoped = Object.fromEntries(Object.entries(levels).filter(([key]) => ['COMMODITY', 'BAG'].includes(parseStockKey(key).ledger)));
      const existing = counters.data.filter(c => c.ledger === 'COMMODITY' || c.ledger === 'BAG').map(c => c.id);
      await rebuildBalanceCounters(companyId, scoped, existing);
      setSuccessMessage('Stock balance counters rebuilt from transaction history.');
    } catch (error) {
      setErrorMessage(formatFirestoreError(error));
    } finally {
      setRebuilding(false);
    }
  };

  const available = (warehouseId: string, item: string) => levelFor(levels, 'COMMODITY', warehouseId, item);
  const availableBags = (warehouseId: string, item: PackagingType) => levelFor(levels, 'BAG', warehouseId, item);
  const defaultWarehouse = selectedWarehouseId !== 'ALL' ? selectedWarehouseId : profile?.assignedWarehouseId || '';

  return (
    <div className="flex flex-col h-full bg-[var(--bg-app)]">
      <ConfirmModal isOpen={!!deletingTx} title="Delete purchase" message="The purchase is hidden from reports and its stock is removed. This is recorded in the audit log." confirmText="Delete" requireReason onConfirm={deletePurchase} onCancel={() => setDeletingTx(null)} />
      <ConfirmModal isOpen={!!deletingAdjustment} title="Delete adjustment" message="Stock levels are recalculated without this adjustment." confirmText="Delete" requireReason onConfirm={deleteAdjustment} onCancel={() => setDeletingAdjustment(null)} />

      <header className="bg-white border-b border-[var(--border)] px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-bold text-[var(--text-primary)] shrink-0">Inventory</h1>
          {!panel && !editingTx && !editingAdjustment && (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {tab === 'COMMODITIES' && can('transfer_stock') && (
                <button onClick={() => setPanel('transfer')} className="google-btn-secondary flex items-center gap-2 shrink-0"><ArrowRightLeft size={18} /> Transfer</button>
              )}
              {tab === 'COMMODITIES' && can('create_trade') && (
                <button onClick={() => setPanel('purchase')} className="google-btn-primary flex items-center gap-2 shrink-0"><Plus size={18} /> Purchase</button>
              )}
              {tab === 'PACKAGING' && can('transfer_stock') && (
                <button onClick={() => setPanel('bagTransfer')} className="google-btn-secondary flex items-center gap-2 shrink-0"><ArrowRightLeft size={18} /> Transfer</button>
              )}
              {tab === 'PACKAGING' && can('record_bags') && (
                <button onClick={() => setPanel('bag')} className="google-btn-primary flex items-center gap-2 shrink-0"><Plus size={18} /> Bag entry</button>
              )}
              {tab === 'ADJUSTMENTS' && can('adjust_inventory') && (
                <button onClick={() => setPanel('adjustment')} className="google-btn-primary flex items-center gap-2 shrink-0"><Plus size={18} /> Adjustment</button>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
        {driftCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <AlertTriangle className="text-amber-600 shrink-0" size={20} />
            <p className="text-xs text-amber-800 flex-1">
              {driftCount} stock balance counter(s) differ from transaction history (usually records entered before this update). Rebuild them so availability checks use the correct figures.
            </p>
            <button onClick={rebuildCounters} disabled={rebuilding} className="bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-50">
              <Wrench size={14} /> {rebuilding ? 'Rebuilding…' : 'Rebuild counters'}
            </button>
          </div>
        )}

        <div className="flex bg-slate-100 p-1 rounded-xl">
          {(['COMMODITIES', 'PACKAGING', 'ADJUSTMENTS'] as Tab[]).map(t => (
            <button key={t} onClick={() => { setTab(t); closePanels(); }} className={cn('flex-1 py-2 rounded-lg text-xs font-bold', tab === t ? 'bg-white text-[var(--accent)] shadow-sm' : 'text-[var(--text-secondary)]')}>
              {t === 'COMMODITIES' ? 'Commodities' : t === 'PACKAGING' ? 'Packaging (bags)' : 'Stock adjustments'}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {panel === 'adjustment' || editingAdjustment ? (
            <AdjustmentForm key="adjustment" warehouses={warehouses} available={available} defaultWarehouseId={defaultWarehouse} editingAdjustment={editingAdjustment} submitting={busy} onCancel={closePanels} onSubmit={saveAdjustment} />
          ) : panel === 'purchase' || editingTx ? (
            <PurchaseForm key={editingTx?.id ?? 'purchase'} suppliers={suppliers} warehouses={warehouses} defaultWarehouseId={defaultWarehouse} editingTransaction={editingTx} submitting={busy} onCancel={closePanels} onSubmit={savePurchase} />
          ) : panel === 'bagTransfer' ? (
            <BagTransferForm key="bag-transfer" warehouses={warehouses} available={availableBags} submitting={busy} onCancel={closePanels} onSubmit={saveBagTransfer} />
          ) : panel === 'bag' ? (
            <BagTransactionForm key="bag" suppliers={suppliers} warehouses={warehouses} available={availableBags} defaultWarehouseId={defaultWarehouse} submitting={busy} onCancel={closePanels} onSubmit={saveBagTransaction} />
          ) : panel === 'transfer' ? (
            <StockTransferForm key="transfer" warehouses={warehouses} available={available} submitting={busy} onCancel={closePanels} onSubmit={saveTransfer} />
          ) : (
            <div key="lists" className="space-y-6">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
                <button onClick={() => setSelectedWarehouseId('ALL')} className={cn('px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap', selectedWarehouseId === 'ALL' ? 'bg-[var(--text-primary)] text-white' : 'bg-white text-[var(--text-secondary)] border border-[var(--border)]')}>
                  All warehouses
                </button>
                {warehouses.map(w => (
                  <button key={w.id} onClick={() => setSelectedWarehouseId(w.id)} className={cn('px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap', selectedWarehouseId === w.id ? 'bg-[var(--accent)] text-white' : 'bg-white text-[var(--text-secondary)] border border-[var(--border)]')}>
                    {w.name}
                  </button>
                ))}
              </div>

              <InventoryStats activeTab={tab === 'PACKAGING' ? 'PACKAGING' : 'COMMODITIES'} inventory={commodityStock} packagingInventory={bagStock} />

              {tab === 'ADJUSTMENTS' ? (
                <AdjustmentLedger
                  adjustments={adjustments}
                  warehouses={warehouses}
                  canEdit={can('adjust_inventory')}
                  canDelete={can('delete_inventory_adjustment')}
                  onEdit={setEditingAdjustment}
                  onDelete={setDeletingAdjustment}
                />
              ) : (
                <TransactionList
                  activeTab={tab}
                  transactions={purchases}
                  bagTransactions={bags}
                  suppliers={suppliers}
                  warehouses={warehouses}
                  canEdit={can('edit_trade')}
                  canDelete={can('delete_trade')}
                  onEdit={setEditingTx}
                  onDelete={setDeletingTx}
                />
              )}
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
