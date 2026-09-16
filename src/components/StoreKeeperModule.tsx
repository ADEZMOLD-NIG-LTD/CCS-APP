/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { ArrowRightLeft, Package, Plus } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useCompanyCollection, useDerivedLevels, useWarehouses } from '../contexts/CompanyDataContext';
import { useBalanceGuard, useCommit } from '../hooks/useCommit';
import { AuditAction, auditOp } from '../lib/audit';
import { diffEffects, levelFor, parseStockKey, storeRecordStockEffects } from '../lib/finance';
import { daysAgoLocal, isWithinLocalRange, localDateToIso, todayLocal } from '../lib/dates';
import { newId } from '../lib/utils';
import type { StoreRecord } from '../types';
import ConfirmModal from './ConfirmModal';
import StoreRecordForm, { type StoreRecordInput } from './store/StoreRecordForm';
import StoreRecordList from './store/StoreRecordList';
import StoreKeeperSummary from './store/StoreKeeperSummary';

export default function StoreKeeperModule() {
  const { profile, can, auditActor } = useAuth();
  const { commit, busy } = useCommit();
  const recordsState = useCompanyCollection('store_records');
  const { data: warehouses } = useWarehouses();
  const { levels } = useDerivedLevels({ store: true });
  const guardFor = useBalanceGuard(levels);

  const [warehouseId, setWarehouseId] = useState<string>(profile?.assignedWarehouseId || 'ALL');
  const [range, setRange] = useState({ start: daysAgoLocal(30), end: todayLocal() });
  const [form, setForm] = useState<null | { mode: 'IN' | 'TRANSFER'; record: StoreRecord | null }>(null);
  const [deleting, setDeleting] = useState<StoreRecord | null>(null);

  const records = useMemo(() => recordsState.data.filter(r => !r.isDeleted).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [recordsState.data]);
  const matchesWarehouse = (r: StoreRecord) => warehouseId === 'ALL' || (r.type === 'TRANSFER' ? r.sourceWarehouseId === warehouseId || r.destinationWarehouseId === warehouseId : r.warehouseId === warehouseId);
  const filtered = useMemo(() => records.filter(r => isWithinLocalRange(r.date, range.start, range.end) && matchesWarehouse(r)), [records, range, warehouseId]);

  const totals = useMemo(() => {
    const acc = { totalInWeight: 0, totalInBags: 0, totalOutWeight: 0, totalOutBags: 0, inByCommodity: {} as Record<string, { weight: number; bags: number }>, outByCommodity: {} as Record<string, { weight: number; bags: number }> };
    const add = (bucket: 'in' | 'out', r: StoreRecord) => {
      const target = bucket === 'in' ? acc.inByCommodity : acc.outByCommodity;
      target[r.commodity] = target[r.commodity] || { weight: 0, bags: 0 };
      target[r.commodity].weight += r.actualWeight;
      target[r.commodity].bags += r.noOfBags;
      if (bucket === 'in') { acc.totalInWeight += r.actualWeight; acc.totalInBags += r.noOfBags; } else { acc.totalOutWeight += r.actualWeight; acc.totalOutBags += r.noOfBags; }
    };
    for (const r of filtered) {
      if (r.type === 'TRANSFER') {
        if (warehouseId === 'ALL' || r.sourceWarehouseId === warehouseId) add('out', r);
        if (warehouseId === 'ALL' || r.destinationWarehouseId === warehouseId) add('in', r);
      } else add(r.type === 'IN' ? 'in' : 'out', r);
    }
    return acc;
  }, [filtered, warehouseId]);

  const inventoryByCommodity = useMemo(() => {
    const inv: Record<string, { quantity: number; bags: number }> = {};
    for (const [key, qty] of Object.entries(levels)) {
      const { ledger, warehouseId: wh, item } = parseStockKey(key);
      if (ledger !== 'STORE' || (warehouseId !== 'ALL' && wh !== warehouseId)) continue;
      inv[item] = inv[item] || { quantity: 0, bags: 0 };
      inv[item].quantity += qty;
    }
    for (const r of records) {
      const sign = (wh?: string) => (warehouseId === 'ALL' || wh === warehouseId ? 1 : 0);
      inv[r.commodity] = inv[r.commodity] || { quantity: 0, bags: 0 };
      if (r.type === 'TRANSFER') inv[r.commodity].bags += r.noOfBags * (sign(r.destinationWarehouseId) - sign(r.sourceWarehouseId));
      else inv[r.commodity].bags += (r.type === 'IN' ? 1 : -1) * r.noOfBags * sign(r.warehouseId);
    }
    return inv;
  }, [levels, records, warehouseId]);

  if (!auditActor) return null;
  const actor = auditActor;
  const nowIso = () => new Date().toISOString();

  const save = async (input: StoreRecordInput) => {
    const before = form?.record ?? null;
    const id = before?.id ?? newId();
    const record: StoreRecord = {
      ...(before ?? {}),
      id,
      companyId: actor.companyId,
      date: localDateToIso(input.date, before?.date),
      type: input.type,
      commodity: input.commodity,
      customerName: input.customerName,
      location: input.location,
      nominalWeight: input.nominalWeight,
      actualWeight: input.actualWeight,
      noOfBags: input.noOfBags,
      moisture: input.moisture,
      tare: input.tare,
      fieldOfficer: input.fieldOfficer,
      truckNo: input.truckNo,
      warehouseId: input.type === 'TRANSFER' ? '' : input.warehouseId,
      sourceWarehouseId: input.type === 'TRANSFER' ? input.sourceWarehouseId : undefined,
      destinationWarehouseId: input.type === 'TRANSFER' ? input.destinationWarehouseId : undefined,
      createdByUid: before?.createdByUid ?? actor.uid,
    };
    const ok = await commit(
      [
        { kind: 'set', collection: 'store_records', id, data: { ...record, ...(before ? { updatedAt: nowIso(), updatedByUid: actor.uid } : {}) } },
        auditOp(actor, { action: before ? AuditAction.UPDATE : AuditAction.CREATE, module: 'Store Keeper', recordId: id, details: `${before ? 'Updated' : 'Added'} store record ${record.type} ${record.actualWeight}kg ${record.commodity}`, previousData: before, newData: record }),
      ],
      { guard: guardFor(diffEffects(storeRecordStockEffects(before), storeRecordStockEffects(record))), success: before ? 'Record updated.' : 'Record added.', context: 'store_records' }
    );
    if (ok) setForm(null);
  };

  const remove = async (reason?: string) => {
    const record = deleting;
    if (!record || !reason?.trim()) return;
    const ok = await commit(
      [
        { kind: 'update', collection: 'store_records', id: record.id, data: { isDeleted: true, deletionReason: reason.trim(), deletedBy: actor.email, deletedByUid: actor.uid, deletedAt: nowIso() } },
        auditOp(actor, { action: AuditAction.DELETE, module: 'Store Keeper', recordId: record.id, details: `Deleted store record. Reason: ${reason.trim()}`, previousData: record }),
      ],
      { guard: guardFor(diffEffects(storeRecordStockEffects(record), [])), success: 'Record deleted.', context: 'store_records' }
    );
    if (ok) setDeleting(null);
  };

  const canManage = can('manage_store_records');

  return (
    <div className="space-y-6 p-4">
      <ConfirmModal isOpen={!!deleting} title="Delete store record" message="The record is removed from the store register and stock totals." confirmText="Delete" requireReason onConfirm={remove} onCancel={() => setDeleting(null)} />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Package className="w-8 h-8 text-indigo-600" /> Store records</h2>
          <p className="text-gray-500">Independent warehouse register for dual control</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-3">
            <button onClick={() => setForm({ mode: 'TRANSFER', record: null })} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg border border-blue-200"><ArrowRightLeft className="w-5 h-5" /> Transfer</button>
            <button onClick={() => setForm({ mode: 'IN', record: null })} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg"><Plus className="w-5 h-5" /> Add record</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <label className="block text-sm font-medium text-gray-700">Warehouse
          <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)} className="mt-1 w-full rounded-lg border-gray-300">
            <option value="ALL">All warehouses</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium text-gray-700">From
          <input type="date" value={range.start} onChange={e => setRange(r => ({ ...r, start: e.target.value }))} className="mt-1 w-full rounded-lg border-gray-300" />
        </label>
        <label className="block text-sm font-medium text-gray-700">To
          <input type="date" value={range.end} onChange={e => setRange(r => ({ ...r, end: e.target.value }))} className="mt-1 w-full rounded-lg border-gray-300" />
        </label>
      </div>

      <StoreKeeperSummary totals={totals} inventoryByCommodity={inventoryByCommodity} recordCount={filtered.length} />

      <StoreRecordList
        records={filtered}
        warehouses={warehouses}
        canEdit={canManage}
        canDelete={can('delete_store_records')}
        onEdit={record => setForm({ mode: record.type === 'TRANSFER' ? 'TRANSFER' : 'IN', record })}
        onDelete={setDeleting}
      />

      <AnimatePresence>
        {form && (
          <StoreRecordForm
            key={form.record?.id ?? form.mode}
            initialType={form.mode}
            editingRecord={form.record}
            warehouses={warehouses}
            defaultWarehouseId={warehouseId !== 'ALL' ? warehouseId : profile?.assignedWarehouseId || ''}
            available={(wh, commodity) => levelFor(levels, 'STORE', wh, commodity)}
            submitting={busy}
            onCancel={() => setForm(null)}
            onSubmit={save}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
