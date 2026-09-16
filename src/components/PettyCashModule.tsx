/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, PlusCircle, Trash2, Wallet, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useCompanyCollection, useDerivedLevels, useWarehouses } from '../contexts/CompanyDataContext';
import { useBalanceGuard, useCommit } from '../hooks/useCommit';
import { AuditAction, auditOp } from '../lib/audit';
import { diffEffects, levelFor, levelsByItem, pettyCashEffects } from '../lib/finance';
import { localDateToIso, todayLocal } from '../lib/dates';
import { cn, formatCurrency, newId, roundTo, toNumber } from '../lib/utils';
import type { Precondition, WriteOp } from '../lib/writes';
import type { PettyCashTransaction } from '../types';
import { DigitFormattedInput } from './DigitFormattedInput';
import ConfirmModal from './ConfirmModal';

const CATEGORIES = ['Office Supplies', 'Fuel & Transportation', 'Loading & Labor', 'Minor Repairs', 'Meals & Entertainment', 'Utility & Security', 'Cleaning', 'Other Minor Expense'];
const LOW_BALANCE = 10_000;
const field = 'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-400';

export default function PettyCashModule() {
  const { profile, role, can, auditActor, setErrorMessage } = useAuth();
  const { commit, busy } = useCommit();
  const txState = useCompanyCollection('petty_cash');
  const { data: warehouses } = useWarehouses();
  const { levels } = useDerivedLevels({ pettyCash: true });
  const guardFor = useBalanceGuard(levels);

  const canFund = can('fund_petty_cash');
  const lockedWarehouse = !canFund && profile?.assignedWarehouseId ? profile.assignedWarehouseId : null;
  const [warehouseId, setWarehouseId] = useState(lockedWarehouse || 'ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'DISBURSEMENT' | 'EXPENSE'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'RETIRED'>('ALL');
  const [adding, setAdding] = useState<null | 'EXPENSE' | 'DISBURSEMENT'>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [retiring, setRetiring] = useState(false);
  const [deleting, setDeleting] = useState<PettyCashTransaction | null>(null);

  const transactions = useMemo(
    () => txState.data.filter(t => !t.isDeleted).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || new Date(b.postingDate).getTime() - new Date(a.postingDate).getTime()),
    [txState.data]
  );
  const filtered = useMemo(
    () => transactions.filter(t => (warehouseId === 'ALL' || t.warehouseId === warehouseId) && (typeFilter === 'ALL' || t.type === typeFilter) && (statusFilter === 'ALL' || t.status === statusFilter)),
    [transactions, warehouseId, typeFilter, statusFilter]
  );
  const metrics = useMemo(() => {
    const scoped = transactions.filter(t => warehouseId === 'ALL' || t.warehouseId === warehouseId);
    const disbursed = scoped.filter(t => t.type === 'DISBURSEMENT').reduce((s, t) => s + t.amount, 0);
    const spent = scoped.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
    const pending = scoped.filter(t => t.type === 'EXPENSE' && t.status === 'PENDING').reduce((s, t) => s + t.amount, 0);
    const balance = levelsByItem(levels, 'PETTY_CASH', warehouseId).NGN || 0;
    return { disbursed: roundTo(disbursed, 2), spent: roundTo(spent, 2), pending: roundTo(pending, 2), balance };
  }, [transactions, warehouseId, levels]);

  if (!auditActor) return null;
  const actor = auditActor;
  const nowIso = () => new Date().toISOString();
  const selectedTxs = transactions.filter(t => selected.includes(t.id) && t.type === 'EXPENSE' && t.status === 'PENDING');

  const addTransaction = async (form: HTMLFormElement) => {
    const type = adding;
    if (!type) return;
    const data = new FormData(form);
    const amount = roundTo(toNumber(data.get('amount')), 2);
    const whId = lockedWarehouse ?? String(data.get('warehouseId') ?? '');
    const description = String(data.get('description') ?? '').trim();
    if (amount <= 0) return setErrorMessage('Amount must be greater than zero.');
    if (!whId) return setErrorMessage('Select a store / warehouse.');
    if (!description) return setErrorMessage('Enter a description.');
    const dateIso = localDateToIso(String(data.get('date') ?? todayLocal()));
    const id = newId();
    const record: PettyCashTransaction = {
      id,
      companyId: actor.companyId,
      warehouseId: whId,
      date: dateIso,
      postingDate: nowIso(),
      type,
      amount,
      category: type === 'DISBURSEMENT' ? 'Replenish Petty Cash' : String(data.get('category') ?? ''),
      description,
      recipient: type === 'DISBURSEMENT' ? 'Petty Cash Box' : String(data.get('recipient') ?? '').trim() || 'Staff',
      status: type === 'DISBURSEMENT' ? 'RETIRED' : 'PENDING',
      reference: String(data.get('reference') ?? '').trim() || undefined,
      createdBy: actor.uid,
      creatorEmail: actor.email,
    };
    if (type === 'EXPENSE' && !record.category) return setErrorMessage('Choose a category.');

    const ops: WriteOp[] = [];
    if (type === 'DISBURSEMENT' && data.get('postToJournal') === 'on') {
      const journalId = newId();
      record.retiredJournalId = journalId;
      record.retiredDate = nowIso();
      ops.push({
        kind: 'set',
        collection: 'journal',
        id: journalId,
        data: {
          id: journalId, companyId: actor.companyId, warehouseId: whId, date: dateIso, postingDate: nowIso(), type: 'OUTFLOW',
          category: 'PETTY CASH', amount, description: `Petty cash funding: ${description}`, paymentMethod: String(data.get('fundingMethod') ?? 'CASH'),
          source: 'PETTY_CASH', cashEffect: true, reference: id, createdByUid: actor.uid,
        },
      });
    }
    ops.push({ kind: 'set', collection: 'petty_cash', id, data: { ...record } });
    ops.push(auditOp(actor, { action: AuditAction.CREATE, module: 'Petty Cash', recordId: id, details: `${type === 'DISBURSEMENT' ? 'Funded' : 'Spent'} ${formatCurrency(amount)} (${record.category})`, newData: record }));

    const ok = await commit(ops, { guard: guardFor(diffEffects([], pettyCashEffects(record))), success: type === 'DISBURSEMENT' ? 'Petty cash funded.' : 'Expense recorded.', context: 'petty_cash' });
    if (ok) setAdding(null);
  };

  const retire = async (form: HTMLFormElement) => {
    if (selectedTxs.length === 0) return;
    const data = new FormData(form);
    const retiredIso = localDateToIso(String(data.get('retiredDate') ?? todayLocal()));
    const byWarehouse = new Map<string, PettyCashTransaction[]>();
    selectedTxs.forEach(t => byWarehouse.set(t.warehouseId, [...(byWarehouse.get(t.warehouseId) ?? []), t]));

    const ops: WriteOp[] = [];
    const preconditions: Precondition[] = [];
    let total = 0;
    for (const [whId, items] of byWarehouse) {
      const journalId = newId();
      const amount = roundTo(items.reduce((s, t) => s + t.amount, 0), 2);
      total += amount;
      // Expense recognition only: the cash left the main book when the box was funded.
      ops.push({
        kind: 'set',
        collection: 'journal',
        id: journalId,
        data: {
          id: journalId, companyId: actor.companyId, warehouseId: whId, date: retiredIso, postingDate: nowIso(), type: 'OUTFLOW',
          category: 'PETTY CASH RETIREMENT', amount,
          description: `Petty cash retirement (${items.length}): ${items.map(t => `${t.category} ${formatCurrency(t.amount)}`).join(', ')}`.slice(0, 290),
          source: 'PETTY_CASH', cashEffect: false, createdByUid: actor.uid,
        },
      });
      items.forEach(t => {
        ops.push({ kind: 'update', collection: 'petty_cash', id: t.id, data: { status: 'RETIRED', retiredDate: retiredIso, retiredJournalId: journalId, updatedAt: nowIso(), updatedByUid: actor.uid } });
        preconditions.push({ collection: 'petty_cash', id: t.id, field: 'status', equals: 'PENDING', message: 'One of the selected expenses was already retired by someone else. Refresh and try again.' });
      });
    }
    ops.push(auditOp(actor, { action: AuditAction.UPDATE, module: 'Petty Cash', recordId: selectedTxs[0].id, details: `Retired ${selectedTxs.length} petty cash expenses totalling ${formatCurrency(total)}` }));

    const ok = await commit(ops, { preconditions, success: `Retired ${selectedTxs.length} expense(s).`, context: 'petty_cash' });
    if (ok) {
      setSelected([]);
      setRetiring(false);
    }
  };

  const remove = async (reason?: string) => {
    const tx = deleting;
    if (!tx || !reason?.trim()) return;
    if (tx.type === 'EXPENSE' && tx.status === 'RETIRED') return setErrorMessage('Retired expenses are part of the journal and cannot be deleted.');
    const deletion = { isDeleted: true, deletionReason: reason.trim(), deletedBy: actor.email, deletedByUid: actor.uid, deletedAt: nowIso() };
    const ops: WriteOp[] = [{ kind: 'update', collection: 'petty_cash', id: tx.id, data: deletion }];
    if (tx.type === 'DISBURSEMENT' && tx.retiredJournalId) ops.push({ kind: 'update', collection: 'journal', id: tx.retiredJournalId, data: deletion });
    ops.push(auditOp(actor, { action: AuditAction.DELETE, module: 'Petty Cash', recordId: tx.id, details: `Deleted petty cash ${tx.type.toLowerCase()} of ${formatCurrency(tx.amount)}. Reason: ${reason.trim()}`, previousData: tx }));
    const ok = await commit(ops, {
      guard: guardFor(diffEffects(pettyCashEffects(tx), [])),
      preconditions: [{ collection: 'petty_cash', id: tx.id, field: 'status', equals: tx.status, message: 'This record changed. Refresh and try again.' }],
      success: 'Petty cash record deleted.',
      context: 'petty_cash',
    });
    if (ok) setDeleting(null);
  };

  const pendingInView = filtered.filter(t => t.type === 'EXPENSE' && t.status === 'PENDING');
  const warehouseName = (id: string) => warehouses.find(w => w.id === id)?.name || 'Unassigned';

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 text-slate-800">
      <ConfirmModal isOpen={!!deleting} title="Delete petty cash record" message={deleting?.type === 'DISBURSEMENT' ? 'Deleting a funding entry also removes its journal outflow. It is blocked if the money has already been spent.' : 'The expense is removed and the amount returns to the petty cash balance.'} confirmText="Delete" requireReason onConfirm={remove} onCancel={() => setDeleting(null)} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3"><Wallet className="text-slate-600" size={32} /> Petty cash</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Cash-in-hand expenses, replenishments and retirement to the journal.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedTxs.length > 0 && canFund && (
            <button onClick={() => setRetiring(true)} className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg">Retire selected ({selectedTxs.length})</button>
          )}
          {can('record_petty_expense') && (
            <button onClick={() => setAdding('EXPENSE')} className="px-4 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-bold shadow-md flex items-center gap-2"><PlusCircle size={18} /> Add expense</button>
          )}
          {canFund && (
            <button onClick={() => setAdding('DISBURSEMENT')} className="px-4 py-2.5 border border-slate-300 bg-white text-slate-700 rounded-xl text-sm font-bold">Fund petty cash</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[['Funded', metrics.disbursed], ['Spent', metrics.spent]].map(([label, value]) => (
          <div key={label as string} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <span className="text-xs font-bold text-slate-400 uppercase">{label}</span>
            <span className="text-2xl font-black text-slate-900 mt-1 block">{formatCurrency(value as number)}</span>
          </div>
        ))}
        <div className={cn('p-5 rounded-2xl border shadow-sm', metrics.balance < LOW_BALANCE ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200')}>
          <span className="text-xs font-bold text-slate-400 uppercase">Balance</span>
          <span className="text-2xl font-black mt-1 block">{formatCurrency(metrics.balance)}</span>
          {metrics.balance < LOW_BALANCE && <span className="text-[10px] font-bold text-rose-600">Low balance — replenish soon</span>}
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase">Awaiting retirement</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">{formatCurrency(metrics.pending)}</span>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-wrap gap-3 items-end justify-between">
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col text-[10px] font-bold text-slate-400 uppercase">Store
            <select value={warehouseId} disabled={!!lockedWarehouse} onChange={e => setWarehouseId(e.target.value)} className="mt-1 text-xs font-semibold px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg">
              <option value="ALL">All stores</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col text-[10px] font-bold text-slate-400 uppercase">Type
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as typeof typeFilter)} className="mt-1 text-xs font-semibold px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg">
              <option value="ALL">All</option>
              <option value="EXPENSE">Expenses</option>
              <option value="DISBURSEMENT">Funding</option>
            </select>
          </label>
          <label className="flex flex-col text-[10px] font-bold text-slate-400 uppercase">Status
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} className="mt-1 text-xs font-semibold px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg">
              <option value="ALL">All</option>
              <option value="PENDING">Pending</option>
              <option value="RETIRED">Retired</option>
            </select>
          </label>
        </div>
        <span className="text-xs text-slate-400">{filtered.length} record(s)</span>
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase">
              <th className="py-4 px-4 w-12">
                {canFund && pendingInView.length > 0 && (
                  <input type="checkbox" aria-label="Select all pending" checked={pendingInView.every(t => selected.includes(t.id))} onChange={e => setSelected(e.target.checked ? pendingInView.map(t => t.id) : [])} />
                )}
              </th>
              {['Date', 'Store', 'Type', 'Category', 'Amount', 'Recipient', 'Description', 'Status', ''].map(h => <th key={h} className="py-4 px-4 whitespace-nowrap">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-10 text-slate-400">No petty cash records for this selection.</td></tr>
            ) : filtered.map(tx => {
              const pending = tx.type === 'EXPENSE' && tx.status === 'PENDING';
              const deletable = canFund && !(tx.type === 'EXPENSE' && tx.status === 'RETIRED');
              return (
                <tr key={tx.id} className={cn('hover:bg-slate-50/50', selected.includes(tx.id) && 'bg-indigo-50/30')}>
                  <td className="py-3 px-4 text-center">
                    {pending && canFund ? <input type="checkbox" aria-label="Select expense" checked={selected.includes(tx.id)} onChange={() => setSelected(prev => prev.includes(tx.id) ? prev.filter(id => id !== tx.id) : [...prev, tx.id])} /> : null}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">{new Date(tx.date).toLocaleDateString()}</td>
                  <td className="py-3 px-4 whitespace-nowrap font-bold">{warehouseName(tx.warehouseId)}</td>
                  <td className="py-3 px-4"><span className={cn('px-2 py-0.5 rounded-full text-[10px] font-extrabold', tx.type === 'DISBURSEMENT' ? 'bg-sky-50 text-sky-700' : 'bg-indigo-50 text-indigo-700')}>{tx.type === 'DISBURSEMENT' ? 'FUNDING' : 'EXPENSE'}</span></td>
                  <td className="py-3 px-4 whitespace-nowrap">{tx.category}</td>
                  <td className="py-3 px-4 whitespace-nowrap text-right font-black">{formatCurrency(tx.amount)}</td>
                  <td className="py-3 px-4 whitespace-nowrap">{tx.recipient}</td>
                  <td className="py-3 px-4 max-w-xs"><p className="truncate">{tx.description}</p>{tx.reference && <p className="text-[10px] text-slate-400">Ref: {tx.reference}</p>}</td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    {tx.type === 'DISBURSEMENT' ? <span className="text-[11px] font-bold text-indigo-600 flex items-center gap-1"><CheckCircle size={12} /> Funded{tx.retiredJournalId ? ' · in journal' : ''}</span>
                      : tx.status === 'RETIRED' ? <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1"><CheckCircle size={12} /> Retired</span>
                      : <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Pending</span>}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {deletable && <button onClick={() => setDeleting(tx)} className="text-slate-400 hover:text-rose-600 p-1.5" aria-label="Delete record"><Trash2 size={16} /></button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {adding && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden" role="dialog">
            <div className="bg-slate-800 text-white px-6 py-5 flex items-center justify-between">
              <h3 className="text-lg font-black">{adding === 'DISBURSEMENT' ? 'Fund petty cash' : 'Record expense'}</h3>
              <button onClick={() => setAdding(null)} className="text-slate-400 hover:text-white" aria-label="Close"><X size={20} /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); addTransaction(e.currentTarget); }} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <label className="block text-xs font-bold text-slate-500 uppercase">Date
                  <input name="date" type="date" required max={todayLocal()} defaultValue={todayLocal()} className={cn(field, 'mt-1.5')} />
                </label>
                <label className="block text-xs font-bold text-slate-500 uppercase">Store
                  <select name="warehouseId" required defaultValue={lockedWarehouse ?? profile?.assignedWarehouseId ?? ''} disabled={!!lockedWarehouse} className={cn(field, 'mt-1.5')}>
                    <option value="">Select store</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-bold text-slate-500 uppercase">Amount
                  <div className="mt-1.5"><DigitFormattedInput name="amount" required className={field} prefix="₦" /></div>
                </label>
                {adding === 'EXPENSE' ? (
                  <label className="block text-xs font-bold text-slate-500 uppercase">Category
                    <select name="category" required className={cn(field, 'mt-1.5')}>
                      <option value="">Select category</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                ) : (
                  <label className="block text-xs font-bold text-slate-500 uppercase">Paid from
                    <select name="fundingMethod" className={cn(field, 'mt-1.5')}>
                      <option value="CASH">Main cash</option>
                      <option value="BANK_TRANSFER">Bank</option>
                    </select>
                  </label>
                )}
              </div>
              {adding === 'EXPENSE' && (
                <div className="grid grid-cols-2 gap-4">
                  <input name="recipient" maxLength={100} className={field} placeholder="Recipient" aria-label="Recipient" />
                  <input name="reference" maxLength={60} className={field} placeholder="Voucher no." aria-label="Voucher number" />
                </div>
              )}
              <textarea name="description" required maxLength={300} rows={2} className={field} placeholder="Purpose" aria-label="Description" />
              {adding === 'EXPENSE' && warehouseId !== 'ALL' && (
                <p className="text-[11px] text-slate-500">Available at {warehouseName(warehouseId)}: {formatCurrency(levelFor(levels, 'PETTY_CASH', warehouseId, 'NGN'))}</p>
              )}
              {adding === 'DISBURSEMENT' && (
                <label className="flex items-start gap-3 bg-sky-50 border border-sky-100 p-3 rounded-xl text-xs font-semibold text-sky-950">
                  <input name="postToJournal" type="checkbox" defaultChecked className="h-4 w-4 mt-0.5" />
                  <span>Post this funding to the general journal as a cash outflow (category PETTY CASH).<span className="block font-normal text-[10px] text-sky-600">Untick only if the money came from outside the company's books.</span></span>
                </label>
              )}
              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => setAdding(null)} className="px-4 py-2.5 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl">Cancel</button>
                <button type="submit" disabled={busy} className="px-5 py-2.5 bg-slate-800 text-white text-xs font-bold rounded-xl disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {retiring && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden" role="dialog">
            <div className="bg-emerald-800 text-white px-6 py-5 flex items-center justify-between">
              <h3 className="text-lg font-black">Retire expenses</h3>
              <button onClick={() => setRetiring(false)} className="text-emerald-200 hover:text-white" aria-label="Close"><X size={20} /></button>
            </div>
            <form onSubmit={e => { e.preventDefault(); retire(e.currentTarget); }} className="p-6 space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex justify-between">
                <span className="text-sm font-bold">{selectedTxs.length} expense(s)</span>
                <span className="text-lg font-black text-emerald-700">{formatCurrency(selectedTxs.reduce((s, t) => s + t.amount, 0))}</span>
              </div>
              <label className="block text-xs font-bold text-slate-500 uppercase">Retirement date
                <input name="retiredDate" type="date" required max={todayLocal()} defaultValue={todayLocal()} className={cn(field, 'mt-1.5')} />
              </label>
              <p className="text-xs text-slate-500 flex gap-2"><AlertCircle size={14} className="text-emerald-600 shrink-0 mt-0.5" /> One journal expense line is created per store. It records the expense without reducing cash again, because the cash already left the main book when the box was funded.</p>
              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => setRetiring(false)} className="px-4 py-2.5 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl">Cancel</button>
                <button type="submit" disabled={busy} className="px-5 py-2.5 bg-emerald-700 text-white text-xs font-bold rounded-xl disabled:opacity-50">{busy ? 'Retiring…' : 'Retire'}</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
