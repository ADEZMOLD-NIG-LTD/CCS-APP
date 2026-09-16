/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useActiveCollection, useWarehouses } from '../contexts/CompanyDataContext';
import { useCommit } from '../hooks/useCommit';
import { AuditAction, auditOp } from '../lib/audit';
import { buildCashMovements, summarizeCash, type CashMovement } from '../lib/finance';
import { daysAgoLocal, isoToLocalDate, localDateToIso, todayLocal } from '../lib/dates';
import { cn, formatCurrency, newId } from '../lib/utils';
import type { JournalEntry } from '../types';
import ConfirmModal from './ConfirmModal';
import JournalForm, { type JournalFormValues } from './journal/JournalForm';
import JournalList from './journal/JournalList';
import JournalSummary from './journal/JournalSummary';

export default function JournalModule() {
  const { profile, role, can, auditActor } = useAuth();
  const { commit, busy } = useCommit();
  const journal = useActiveCollection('journal').data;
  const payments = useActiveCollection('payments').data;
  const suppliers = useActiveCollection('suppliers').data;
  const buyers = useActiveCollection('buyers').data;
  const { data: warehouses } = useWarehouses();

  const lockedWarehouse = role !== 'ADMIN' && role !== 'MANAGER' && role !== 'ACCOUNT' && profile?.assignedWarehouseId ? profile.assignedWarehouseId : null;
  const [warehouseId, setWarehouseId] = useState(lockedWarehouse || 'ALL');
  const [channel, setChannel] = useState<'ALL' | 'CASH' | 'BANK' | 'OTHER'>('ALL');
  const [startDate, setStartDate] = useState(daysAgoLocal(30));
  const [endDate, setEndDate] = useState(todayLocal());
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<JournalEntry | null>(null);
  const [deleting, setDeleting] = useState<CashMovement | null>(null);

  const movements = useMemo(() => buildCashMovements(journal, payments), [journal, payments]);
  const position = useMemo(() => summarizeCash(movements, { warehouseId }), [movements, warehouseId]);
  const period = useMemo(() => summarizeCash(movements, { warehouseId, start: startDate, end: endDate }), [movements, warehouseId, startDate, endDate]);
  const listed = useMemo(
    () => movements
      .filter(m => (warehouseId === 'ALL' || m.warehouseId === warehouseId) && (channel === 'ALL' || m.channel === channel))
      .filter(m => {
        const day = isoToLocalDate(m.date);
        return day >= startDate && day <= endDate;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || new Date(b.postingDate || b.date).getTime() - new Date(a.postingDate || a.date).getTime()),
    [movements, warehouseId, channel, startDate, endDate]
  );

  if (!auditActor) return null;
  const actor = auditActor;
  const nowIso = () => new Date().toISOString();

  const save = async (values: JournalFormValues) => {
    const before = editing;
    const id = before?.id ?? newId();
    const entry: JournalEntry = {
      ...(before ?? {}),
      id,
      companyId: actor.companyId,
      warehouseId: values.warehouseId,
      date: localDateToIso(values.date, before?.date),
      postingDate: before?.postingDate ?? nowIso(),
      type: values.type,
      category: values.category,
      amount: values.amount,
      description: values.description,
      paymentMethod: values.paymentMethod,
      bankName: values.bankName,
      reference: values.reference,
      supplierId: values.supplierId,
      buyerId: values.buyerId,
      source: before?.source ?? 'MANUAL',
      cashEffect: true,
      excludeFromJournal: undefined,
      createdByUid: before?.createdByUid ?? actor.uid,
    };
    const ok = await commit(
      [
        { kind: 'set', collection: 'journal', id, data: { ...entry, ...(before ? { updatedAt: nowIso(), updatedByUid: actor.uid } : {}) } },
        auditOp(actor, {
          action: before ? AuditAction.UPDATE : AuditAction.CREATE,
          module: 'Journal',
          recordId: id,
          details: `${before ? 'Adjusted' : 'Recorded'} ${entry.type === 'INFLOW' ? 'inflow' : 'outflow'} ${formatCurrency(entry.amount)} (${entry.category})`,
          previousData: before,
          newData: entry,
        }),
      ],
      { success: before ? 'Journal entry updated.' : 'Journal entry recorded.', context: 'journal' }
    );
    if (ok) {
      setAdding(false);
      setEditing(null);
    }
  };

  const remove = async (reason?: string) => {
    const entry = deleting?.journal;
    if (!entry || !reason?.trim()) return;
    const ok = await commit(
      [
        { kind: 'update', collection: 'journal', id: entry.id, data: { isDeleted: true, deletionReason: reason.trim(), deletedBy: actor.email, deletedByUid: actor.uid, deletedAt: nowIso() } },
        auditOp(actor, { action: AuditAction.DELETE, module: 'Journal', recordId: entry.id, details: `Deleted journal entry ${formatCurrency(entry.amount)} (${entry.category}). Reason: ${reason.trim()}`, previousData: entry }),
      ],
      { success: 'Journal entry deleted.', context: 'journal' }
    );
    if (ok) setDeleting(null);
  };

  const formOpen = adding || !!editing;

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <ConfirmModal isOpen={!!deleting} title="Delete journal entry" message="The entry is removed from the cash book and balances. It stays in the audit log." confirmText="Delete" requireReason onConfirm={remove} onCancel={() => setDeleting(null)} />

      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-bold text-slate-900">{formOpen ? (editing ? 'Adjust entry' : 'New entry') : 'General journal'}</h1>
          {formOpen ? (
            <button onClick={() => { setAdding(false); setEditing(null); }} className="text-sm font-bold text-slate-500 flex items-center gap-1"><ArrowLeft size={16} /> Back</button>
          ) : can('post_general_journal') && (
            <button onClick={() => setAdding(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-sm font-bold"><Plus size={18} /> Record entry</button>
          )}
        </div>
        {!formOpen && (
          <div className="space-y-3 mt-2">
            <div className="flex gap-2">
              {(['ALL', 'CASH', 'BANK', 'OTHER'] as const).map(c => (
                <button key={c} onClick={() => setChannel(c)} className={cn('flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase border', channel === c ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-500')}>{c}</button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select value={warehouseId} disabled={!!lockedWarehouse} onChange={e => setWarehouseId(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold" aria-label="Warehouse">
                <option value="ALL">All warehouses</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs" aria-label="From" />
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs" aria-label="To" />
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
        {formOpen ? (
          <JournalForm
            key={editing?.id ?? 'new'}
            initial={editing}
            warehouses={warehouses}
            suppliers={suppliers}
            buyers={buyers}
            defaultWarehouseId={warehouseId !== 'ALL' ? warehouseId : profile?.assignedWarehouseId || ''}
            submitting={busy}
            onSubmit={save}
            onCancel={() => { setAdding(false); setEditing(null); }}
          />
        ) : (
          <>
            <JournalSummary position={position} period={period} periodLabel={`${startDate} → ${endDate}`} />
            <JournalList
              movements={listed}
              suppliers={suppliers}
              buyers={buyers}
              warehouses={warehouses}
              canEdit={can('edit_journal')}
              canDelete={can('delete_journal')}
              onEdit={m => m.journal && setEditing(m.journal)}
              onDelete={m => m.journal && setDeleting(m)}
            />
          </>
        )}
      </main>
    </div>
  );
}
