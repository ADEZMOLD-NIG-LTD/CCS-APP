/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Plus, UserPlus } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useActiveCollection, useCompanyCollection, useDerivedLevels, useWarehouses } from '../contexts/CompanyDataContext';
import { useBalanceGuard, useCommit } from '../hooks/useCommit';
import { AuditAction, auditOp } from '../lib/audit';
import { diffEffects, levelFor, transactionStockEffects } from '../lib/finance';
import { localDateToIso } from '../lib/dates';
import { newId } from '../lib/utils';
import type { Transaction } from '../types';
import SaleForm, { type SaleInput } from './sales/SaleForm';
import BuyerForm, { type BuyerInput, buyerRecordOps } from './sales/BuyerForm';
import SalesList from './sales/SalesList';
import ConfirmModal from './ConfirmModal';

export default function SalesModule() {
  const { profile, can, auditActor, setErrorMessage } = useAuth();
  const { commit, busy } = useCommit();
  const txState = useCompanyCollection('transactions');
  const buyers = useActiveCollection('buyers').data;
  const suppliers = useActiveCollection('suppliers').data;
  const { data: warehouses } = useWarehouses();
  const { levels } = useDerivedLevels({ commodities: true });
  const guardFor = useBalanceGuard(levels);

  const [mode, setMode] = useState<'list' | 'sale' | 'buyer'>('list');
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [warehouseFilter, setWarehouseFilter] = useState<string>(profile?.assignedWarehouseId || 'ALL');

  const sales = useMemo(
    () => txState.data
      .filter(t => t.type === 'SALE' && !t.isDeleted && (warehouseFilter === 'ALL' || t.warehouseId === warehouseFilter))
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()),
    [txState.data, warehouseFilter]
  );

  if (!auditActor) return null;
  const actor = auditActor;
  const nowIso = () => new Date().toISOString();

  const closeForm = () => {
    setMode('list');
    setEditing(null);
  };

  const saveSale = async (input: SaleInput) => {
    const before = editing;
    const id = before?.id ?? newId();
    const record: Transaction = {
      ...(before ?? {}),
      id,
      companyId: actor.companyId,
      date: localDateToIso(input.date, before?.date),
      postingDate: before?.postingDate ?? nowIso(),
      type: 'SALE',
      commodity: input.commodity,
      calculationMethod: input.calculationMethod,
      buyerId: input.buyerId,
      supplierId: input.supplierId,
      isDirectDelivery: input.isDirectDelivery,
      supplierPricePerKg: input.supplierPricePerKg,
      supplierCreditValue: input.supplierCreditValue,
      warehouseId: input.isDirectDelivery ? undefined : input.warehouseId,
      storeRecordId: input.storeRecordId || undefined,
      grossWeight: input.grossWeight,
      netWeight: input.netWeight,
      bags: input.bags,
      noOfBags: input.bags,
      pricePerKg: input.pricePerKg,
      totalValue: input.totalValue,
      referenceId: before?.referenceId ?? `SL-${id.slice(0, 8).toUpperCase()}`,
      truckNo: input.truckNo || undefined,
      driverName: input.driverName || undefined,
      driverPhone: input.driverPhone || undefined,
      staffName: input.staffName || undefined,
      notes: input.notes || undefined,
      deductions: input.deductions,
      createdByUid: before?.createdByUid ?? actor.uid,
      ...(before ? { updatedAt: nowIso(), updatedByUid: actor.uid } : {}),
    };

    const deltas = diffEffects(transactionStockEffects(before), transactionStockEffects(record));
    const ok = await commit(
      [
        { kind: 'set', collection: 'transactions', id, data: { ...record } },
        auditOp(actor, {
          action: before ? AuditAction.UPDATE : AuditAction.CREATE,
          module: 'Sales',
          recordId: id,
          details: `${before ? 'Adjusted' : 'Recorded'} sale ${record.referenceId}: ${record.netWeight}kg ${record.commodity}`,
          previousData: before,
          newData: record,
        }),
      ],
      { guard: guardFor(deltas), success: before ? 'Sale updated.' : 'Sale recorded.', context: 'transactions' }
    );
    if (ok) closeForm();
  };

  const deleteSale = async (reason?: string) => {
    const tx = deleting;
    if (!tx || !reason?.trim()) return;
    const ok = await commit(
      [
        { kind: 'update', collection: 'transactions', id: tx.id, data: { isDeleted: true, deletionReason: reason.trim(), deletedBy: actor.email, deletedByUid: actor.uid, deletedAt: nowIso() } },
        auditOp(actor, { action: AuditAction.DELETE, module: 'Sales', recordId: tx.id, details: `Deleted sale ${tx.referenceId}. Reason: ${reason.trim()}`, previousData: tx }),
      ],
      { guard: guardFor(diffEffects(transactionStockEffects(tx), [])), success: 'Sale deleted.', context: 'transactions' }
    );
    if (ok) setDeleting(null);
  };

  const saveBuyer = async (input: BuyerInput) => {
    if (buyers.some(b => b.name.trim().toLowerCase() === input.name.trim().toLowerCase())) {
      setErrorMessage(`A buyer named "${input.name}" already exists.`);
      return;
    }
    const ok = await commit(buyerRecordOps(actor, input, null), { success: 'Buyer added.', context: 'buyers' });
    if (ok) setMode('list');
  };

  const available = (warehouseId: string, commodity: string) => levelFor(levels, 'COMMODITY', warehouseId, commodity);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <ConfirmModal isOpen={!!deleting} title="Delete sale" message="The sale is removed from reports and ledgers and its stock is put back." confirmText="Delete" requireReason onConfirm={deleteSale} onCancel={() => setDeleting(null)} />

      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-slate-900">Sales</h1>
          {mode === 'list' && (
            <div className="flex gap-2">
              {can('manage_parties') && (
                <button onClick={() => setMode('buyer')} className="bg-slate-100 text-slate-600 px-3 py-2 rounded-xl flex items-center gap-2 text-xs font-bold"><UserPlus size={18} /> Add buyer</button>
              )}
              {can('create_trade') && (
                <button onClick={() => setMode('sale')} className="bg-blue-600 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-sm font-bold"><Plus size={18} /> New sale</button>
              )}
            </div>
          )}
        </div>
        {mode === 'list' && (
          <select value={warehouseFilter} onChange={e => setWarehouseFilter(e.target.value)} className="mt-3 w-full sm:w-auto bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold">
            <option value="ALL">All warehouses (incl. direct deliveries)</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
        <AnimatePresence mode="wait">
          {mode === 'sale' || editing ? (
            <motion.div key={editing?.id ?? 'sale'} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <SaleForm
                editingTransaction={editing}
                warehouses={warehouses}
                buyers={buyers}
                suppliers={suppliers}
                defaultWarehouseId={warehouseFilter !== 'ALL' ? warehouseFilter : profile?.assignedWarehouseId || ''}
                defaultStaffName={profile?.displayName || ''}
                available={available}
                submitting={busy}
                onCancel={closeForm}
                onSubmit={saveSale}
              />
            </motion.div>
          ) : mode === 'buyer' ? (
            <motion.div key="buyer" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
              <BuyerForm editingBuyer={null} submitting={busy} onSubmit={saveBuyer} onCancel={() => setMode('list')} />
            </motion.div>
          ) : (
            <SalesList
              key="list"
              sales={sales}
              buyers={buyers}
              suppliers={suppliers}
              warehouses={warehouses}
              canEdit={can('edit_trade')}
              canDelete={can('delete_trade')}
              onEdit={tx => setEditing(tx)}
              onDelete={setDeleting}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
