/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Building2, Edit2, MapPin, Plus, Trash2, Warehouse as WarehouseIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useActiveCollection, useDerivedLevels, useWarehouses } from '../contexts/CompanyDataContext';
import { useCommit } from '../hooks/useCommit';
import { AuditAction, auditOp } from '../lib/audit';
import { parseStockKey } from '../lib/finance';
import { formatNumber, newId } from '../lib/utils';
import type { Warehouse } from '../types';
import ConfirmModal from './ConfirmModal';

const field = 'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500';

export default function WarehouseModule() {
  const { can, auditActor, setErrorMessage, isModuleEnabled } = useAuth();
  const { commit, busy } = useCommit();
  const { data: warehouses } = useWarehouses();
  // Module-gated collections are unreadable (rules) when the company does not have the module.
  const staff = useActiveCollection('staff', can('view_staff') && isModuleEnabled('staff')).data;
  const { levels } = useDerivedLevels({
    commodities: true,
    bags: true,
    store: can('view_store_records') && isModuleEnabled('store'),
    pettyCash: can('view_petty_cash') && isModuleEnabled('petty_cash'),
  });

  const [editing, setEditing] = useState<Warehouse | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Warehouse | null>(null);

  const holdings = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const [key, qty] of Object.entries(levels)) {
      if (Math.abs(qty) < 0.01) continue;
      const { ledger, warehouseId, item } = parseStockKey(key);
      const label = ledger === 'PETTY_CASH' ? `petty cash ₦${formatNumber(qty)}` : ledger === 'BAG' ? `${formatNumber(qty, 0)} ${item.replace('_', ' ').toLowerCase()}s` : `${formatNumber(qty)}kg ${item}${ledger === 'STORE' ? ' (store register)' : ''}`;
      (map[warehouseId] = map[warehouseId] || []).push(label);
    }
    return map;
  }, [levels]);

  if (!auditActor) return null;
  const actor = auditActor;

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const location = String(form.get('location') ?? '').trim();
    const target = editing === 'new' ? null : editing;
    if (!name) return;
    if (warehouses.some(w => w.id !== target?.id && w.name.trim().toLowerCase() === name.toLowerCase())) {
      setErrorMessage(`A warehouse named "${name}" already exists.`);
      return;
    }
    const id = target?.id ?? newId();
    const record = { ...(target ?? {}), id, companyId: actor.companyId, name, location, createdAt: target?.createdAt ?? new Date().toISOString() };
    const ok = await commit(
      [
        { kind: 'set', collection: 'warehouses', id, data: record },
        auditOp(actor, { action: target ? AuditAction.UPDATE : AuditAction.CREATE, module: 'Warehouses', recordId: id, details: `${target ? 'Updated' : 'Added'} warehouse ${name}`, previousData: target, newData: record }),
      ],
      { success: target ? 'Warehouse updated.' : 'Warehouse added.', context: 'warehouses' }
    );
    if (ok) setEditing(null);
  };

  const remove = async (reason?: string) => {
    const warehouse = deleting;
    if (!warehouse || !reason?.trim()) return;
    if (holdings[warehouse.id]?.length) {
      setErrorMessage(`${warehouse.name} still holds ${holdings[warehouse.id].join(', ')}. Transfer or adjust it to zero before deleting.`);
      return;
    }
    const ok = await commit(
      [
        { kind: 'update', collection: 'warehouses', id: warehouse.id, data: { isDeleted: true, deletionReason: reason.trim(), deletedBy: actor.email, deletedByUid: actor.uid, deletedAt: new Date().toISOString() } },
        auditOp(actor, { action: AuditAction.DELETE, module: 'Warehouses', recordId: warehouse.id, details: `Deleted warehouse ${warehouse.name}. Reason: ${reason.trim()}`, previousData: warehouse }),
      ],
      { success: 'Warehouse deleted.', context: 'warehouses' }
    );
    if (ok) setDeleting(null);
  };

  const target = editing === 'new' ? null : editing;

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <ConfirmModal
        isOpen={!!deleting}
        title="Delete warehouse"
        message={`Delete ${deleting?.name}? Past transactions keep their history.${deleting && staff.some(s => s.assignedWarehouseId === deleting.id) ? ' Staff assigned to it will need a new warehouse.' : ''}`}
        confirmText="Delete"
        requireReason
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />

      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Warehouses</h1>
        {!editing && can('manage_warehouses') && (
          <button onClick={() => setEditing('new')} className="bg-indigo-600 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-sm font-bold"><Plus size={18} /> Add warehouse</button>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
        <AnimatePresence mode="wait">
          {editing ? (
            <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold">{target ? 'Edit warehouse' : 'New warehouse'}</h2>
                <button onClick={() => setEditing(null)} className="text-slate-400">Cancel</button>
              </div>
              <form onSubmit={save} className="space-y-4">
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Name
                  <input required maxLength={120} name="name" defaultValue={target?.name} className={`${field} mt-1`} />
                </label>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Location
                  <input required maxLength={200} name="location" defaultValue={target?.location} className={`${field} mt-1`} />
                </label>
                <button type="submit" disabled={busy} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold shadow-lg disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
              </form>
            </motion.div>
          ) : warehouses.length === 0 ? (
            <div key="empty" className="bg-white rounded-2xl p-12 border border-dashed border-slate-300 text-center">
              <WarehouseIcon className="mx-auto text-slate-200 mb-2" size={48} />
              <p className="text-sm text-slate-400">No warehouses yet</p>
            </div>
          ) : (
            <div key="list" className="grid gap-4">
              {warehouses.map(w => (
                <div key={w.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-3">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0"><Building2 size={24} /></div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900">{w.name}</h3>
                      <p className="flex items-center gap-1 text-xs text-slate-500"><MapPin size={12} /> {w.location}</p>
                      <p className="text-[10px] text-slate-400 mt-1 truncate">{holdings[w.id]?.join(' · ') || 'Empty'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {can('manage_warehouses') && <button onClick={() => setEditing(w)} className="p-2 text-slate-400 hover:text-indigo-600" aria-label={`Edit ${w.name}`}><Edit2 size={18} /></button>}
                    {can('delete_warehouses') && <button onClick={() => setDeleting(w)} className="p-2 text-slate-300 hover:text-rose-600" aria-label={`Delete ${w.name}`}><Trash2 size={18} /></button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
