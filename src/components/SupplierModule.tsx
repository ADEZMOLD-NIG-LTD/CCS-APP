/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, Edit2, Landmark, MapPin, Phone, Plus, Search, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useActiveCollection } from '../contexts/CompanyDataContext';
import { useCommit } from '../hooks/useCommit';
import { AuditAction, auditOp } from '../lib/audit';
import { computeSupplierBalance } from '../lib/finance';
import { cn, formatCurrency, newId, roundTo, toNumber } from '../lib/utils';
import type { Supplier } from '../types';
import { DigitFormattedInput } from './DigitFormattedInput';
import ConfirmModal from './ConfirmModal';
import SupplierDetails from './SupplierDetails';

const field = 'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none';

export default function SupplierModule() {
  const { can, auditActor, setErrorMessage } = useAuth();
  const { commit, busy } = useCommit();
  const suppliers = useActiveCollection('suppliers').data;
  const transactions = useActiveCollection('transactions').data;
  const payments = useActiveCollection('payments').data;
  const journal = useActiveCollection('journal').data;

  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Supplier | null>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return suppliers
      .filter(s => !q || s.name.toLowerCase().includes(q) || (s.phone || '').includes(q) || (s.location || '').toLowerCase().includes(q))
      .map(s => ({ supplier: s, balance: computeSupplierBalance(s, { transactions, payments, journal }) }))
      .sort((a, b) => a.supplier.name.localeCompare(b.supplier.name));
  }, [suppliers, transactions, payments, journal, search]);

  if (!auditActor) return null;
  const actor = auditActor;

  const selected = selectedId ? suppliers.find(s => s.id === selectedId) : undefined;
  if (selected) return <SupplierDetails supplier={selected} onBack={() => setSelectedId(null)} />;

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const target = editing;
    if (!name) return;
    if (suppliers.some(s => s.id !== target?.id && s.name.trim().toLowerCase() === name.toLowerCase())) {
      setErrorMessage(`A supplier named "${name}" already exists. Duplicate names lead to payments being posted to the wrong account.`);
      return;
    }
    const id = target?.id ?? newId();
    const nowIso = new Date().toISOString();
    const record = {
      ...(target ?? {}),
      id,
      companyId: actor.companyId,
      name,
      phone: String(form.get('phone') ?? '').trim(),
      location: String(form.get('location') ?? '').trim(),
      bankName: String(form.get('bankName') ?? '').trim(),
      accountNumber: String(form.get('accountNumber') ?? '').trim(),
      accountName: String(form.get('accountName') ?? '').trim(),
      previousBalance: roundTo(toNumber(form.get('previousBalance')), 2),
      createdAt: target?.createdAt ?? nowIso,
      ...(target ? { updatedAt: nowIso } : {}),
    };
    const ok = await commit(
      [
        { kind: 'set', collection: 'suppliers', id, data: record },
        auditOp(actor, { action: target ? AuditAction.UPDATE : AuditAction.CREATE, module: 'Suppliers', recordId: id, details: `${target ? 'Updated' : 'Added'} supplier ${name}`, previousData: target, newData: record }),
      ],
      { success: target ? 'Supplier updated.' : 'Supplier added.', context: 'suppliers' }
    );
    if (ok) {
      setAdding(false);
      setEditing(null);
    }
  };

  const remove = async (reason?: string) => {
    const supplier = deleting;
    if (!supplier || !reason?.trim()) return;
    const ok = await commit(
      [
        { kind: 'update', collection: 'suppliers', id: supplier.id, data: { isDeleted: true, deletionReason: reason.trim(), deletedBy: actor.email, deletedByUid: actor.uid, deletedAt: new Date().toISOString() } },
        auditOp(actor, { action: AuditAction.DELETE, module: 'Suppliers', recordId: supplier.id, details: `Deleted supplier ${supplier.name}. Reason: ${reason.trim()}`, previousData: supplier }),
      ],
      { success: 'Supplier deleted.', context: 'suppliers' }
    );
    if (ok) setDeleting(null);
  };

  const formTarget = editing;

  return (
    <div className="flex flex-col h-full bg-[var(--bg-app)]">
      <ConfirmModal isOpen={!!deleting} title="Delete supplier" message="The supplier is hidden from lists. Their history stays in reports and the audit log." confirmText="Delete" requireReason onConfirm={remove} onCancel={() => setDeleting(null)} />

      <header className="bg-white border-b border-[var(--border)] px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Suppliers</h1>
          {!adding && !editing && can('manage_parties') && (
            <button onClick={() => setAdding(true)} className="google-btn-primary flex items-center gap-2 text-xs sm:text-sm"><Plus size={20} /> Add supplier</button>
          )}
        </div>
        {!adding && !editing && (
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={18} />
            <input type="search" placeholder="Search by name, phone or location…" value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-slate-100 rounded-xl focus:ring-2 focus:ring-[var(--accent)] text-sm font-medium" />
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          {adding || editing ? (
            <motion.div key={formTarget?.id ?? 'new'} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="google-card p-6">
              <div className="flex items-center gap-2 mb-6">
                <button onClick={() => { setAdding(false); setEditing(null); }} className="text-slate-500 hover:text-slate-900" aria-label="Back"><ArrowLeft size={20} /></button>
                <h2 className="text-lg font-semibold">{formTarget ? 'Edit supplier' : 'Add supplier'}</h2>
              </div>
              <form onSubmit={save} className="space-y-4">
                <label className="block">
                  <span className="block text-xs font-medium text-slate-500 uppercase mb-1">Full name</span>
                  <input required maxLength={200} name="name" defaultValue={formTarget?.name} className={field} />
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="block text-xs font-medium text-slate-500 uppercase mb-1">Phone</span>
                    <input required maxLength={30} name="phone" type="tel" defaultValue={formTarget?.phone} className={field} />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-medium text-slate-500 uppercase mb-1">Location</span>
                    <input required maxLength={120} name="location" defaultValue={formTarget?.location} className={field} />
                  </label>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Landmark size={16} /> Bank details</h3>
                  <input name="bankName" maxLength={100} defaultValue={formTarget?.bankName} className={field} placeholder="Bank name" aria-label="Bank name" />
                  <input name="accountNumber" maxLength={20} inputMode="numeric" defaultValue={formTarget?.accountNumber} className={field} placeholder="Account number" aria-label="Account number" />
                  <input name="accountName" maxLength={120} defaultValue={formTarget?.accountName} className={field} placeholder="Account name" aria-label="Account name" />
                </div>
                <label className="block">
                  <span className="block text-xs font-medium text-slate-500 uppercase mb-1">Opening balance</span>
                  <DigitFormattedInput name="previousBalance" allowNegative defaultValue={formTarget?.previousBalance} className={field} prefix="₦" />
                  <span className="block text-[10px] text-slate-400 mt-1">Positive = you owe the supplier. Negative = the supplier owes you.</span>
                </label>
                <button type="submit" disabled={busy} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold shadow-lg disabled:opacity-50">
                  {busy ? 'Saving…' : formTarget ? 'Update supplier' : 'Save supplier'}
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              {rows.length === 0 ? (
                <div className="text-center py-20">
                  <Search className="text-slate-300 mx-auto mb-4" size={32} />
                  <p className="text-slate-500 font-medium">No suppliers found</p>
                </div>
              ) : rows.map(({ supplier, balance }) => (
                <div key={supplier.id} className="google-card p-4">
                  <button type="button" onClick={() => setSelectedId(supplier.id)} className="w-full text-left flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <h3 className="font-bold text-[var(--text-primary)] truncate">{supplier.name}</h3>
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-[var(--text-secondary)]">
                        <span className="flex items-center gap-1"><Phone size={12} /> {supplier.phone}</span>
                        <span className="flex items-center gap-1"><MapPin size={12} /> {supplier.location}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={cn('text-sm font-bold', balance >= 0 ? 'text-emerald-600' : 'text-rose-600')}>{formatCurrency(Math.abs(balance))}</span>
                      <p className="text-[10px] text-[var(--text-secondary)] uppercase">{balance >= 0 ? 'We owe' : 'Owes us'}</p>
                    </div>
                  </button>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-50">
                    <span className="text-[10px] font-medium text-[var(--text-secondary)] flex items-center gap-2 truncate"><Landmark size={14} /> {supplier.bankName || 'No bank details'}</span>
                    <div className="flex items-center gap-1">
                      {can('manage_parties') && <button onClick={() => setEditing(supplier)} className="p-2 text-slate-400 hover:text-[var(--accent)]" aria-label={`Edit ${supplier.name}`}><Edit2 size={16} /></button>}
                      {can('delete_parties') && <button onClick={() => setDeleting(supplier)} className="p-2 text-slate-400 hover:text-rose-600" aria-label={`Delete ${supplier.name}`}><Trash2 size={16} /></button>}
                      <ChevronRight size={18} className="text-slate-400" />
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
