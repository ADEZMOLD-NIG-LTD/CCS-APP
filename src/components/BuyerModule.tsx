/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Edit2, MapPin, Phone, Plus, Search, Trash2, UserPlus } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useActiveCollection } from '../contexts/CompanyDataContext';
import { useCommit } from '../hooks/useCommit';
import { AuditAction, auditOp } from '../lib/audit';
import { computeBuyerBalance } from '../lib/finance';
import { cn, formatCurrency } from '../lib/utils';
import type { Buyer } from '../types';
import ConfirmModal from './ConfirmModal';
import BuyerDetails from './BuyerDetails';
import BuyerForm, { type BuyerInput, buyerRecordOps } from './sales/BuyerForm';

export default function BuyerModule() {
  const { can, auditActor, setErrorMessage } = useAuth();
  const { commit, busy } = useCommit();
  const buyers = useActiveCollection('buyers').data;
  const transactions = useActiveCollection('transactions').data;
  const journal = useActiveCollection('journal').data;

  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Buyer | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Buyer | null>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return buyers
      .filter(b => !q || b.name.toLowerCase().includes(q) || (b.phone || '').includes(q) || (b.location || '').toLowerCase().includes(q))
      .map(b => ({ buyer: b, balance: computeBuyerBalance(b, { transactions, journal }) }))
      .sort((a, b) => a.buyer.name.localeCompare(b.buyer.name));
  }, [buyers, transactions, journal, search]);

  if (!auditActor) return null;
  const actor = auditActor;

  const selected = selectedId ? buyers.find(b => b.id === selectedId) : undefined;
  if (selected) return <BuyerDetails buyer={selected} onBack={() => setSelectedId(null)} />;

  const save = async (input: BuyerInput) => {
    const target = editing;
    if (buyers.some(b => b.id !== target?.id && b.name.trim().toLowerCase() === input.name.trim().toLowerCase())) {
      setErrorMessage(`A buyer named "${input.name}" already exists.`);
      return;
    }
    const ok = await commit(buyerRecordOps(actor, input, target), { success: target ? 'Buyer updated.' : 'Buyer added.', context: 'buyers' });
    if (ok) {
      setAdding(false);
      setEditing(null);
    }
  };

  const remove = async (reason?: string) => {
    const buyer = deleting;
    if (!buyer || !reason?.trim()) return;
    const ok = await commit(
      [
        { kind: 'update', collection: 'buyers', id: buyer.id, data: { isDeleted: true, deletionReason: reason.trim(), deletedBy: actor.email, deletedByUid: actor.uid, deletedAt: new Date().toISOString() } },
        auditOp(actor, { action: AuditAction.DELETE, module: 'Buyers', recordId: buyer.id, details: `Deleted buyer ${buyer.name}. Reason: ${reason.trim()}`, previousData: buyer }),
      ],
      { success: 'Buyer deleted.', context: 'buyers' }
    );
    if (ok) setDeleting(null);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <ConfirmModal isOpen={!!deleting} title="Delete buyer" message="The buyer is hidden from lists. Their history stays in reports and the audit log." confirmText="Delete" requireReason onConfirm={remove} onCancel={() => setDeleting(null)} />

      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-slate-900">Buyers</h1>
          {!adding && !editing && can('manage_parties') && (
            <button onClick={() => setAdding(true)} className="bg-blue-600 text-white p-2 rounded-full shadow-lg" aria-label="Add buyer"><Plus size={24} /></button>
          )}
        </div>
        {!adding && !editing && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="search" placeholder="Search by name, phone or location…" value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm" />
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          {adding || editing ? (
            <motion.div key="form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
              <BuyerForm editingBuyer={editing} submitting={busy} onSubmit={save} onCancel={() => { setAdding(false); setEditing(null); }} />
            </motion.div>
          ) : (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              {rows.length === 0 ? (
                <div className="text-center py-20">
                  <UserPlus className="text-slate-300 mx-auto mb-4" size={32} />
                  <p className="text-slate-500 font-medium">No buyers found</p>
                </div>
              ) : rows.map(({ buyer, balance }) => (
                <div key={buyer.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-200">
                  <button type="button" onClick={() => setSelectedId(buyer.id)} className="w-full text-left flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 truncate">{buyer.name}</h3>
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><Phone size={12} /> {buyer.phone}</span>
                        <span className="flex items-center gap-1"><MapPin size={12} /> {buyer.location}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={cn('text-sm font-bold', balance >= 0 ? 'text-blue-600' : 'text-rose-600')}>{formatCurrency(balance)}</span>
                      <p className="text-[10px] text-slate-400 uppercase">{balance >= 0 ? 'Owes us' : 'We owe'}</p>
                    </div>
                  </button>
                  {(can('manage_parties') || can('delete_parties')) && (
                    <div className="flex items-center justify-end mt-3 pt-3 border-t border-slate-50 gap-2">
                      {can('manage_parties') && <button onClick={() => setEditing(buyer)} className="p-2 text-slate-400 hover:text-blue-600" aria-label={`Edit ${buyer.name}`}><Edit2 size={16} /></button>}
                      {can('delete_parties') && <button onClick={() => setDeleting(buyer)} className="p-2 text-slate-400 hover:text-rose-600" aria-label={`Delete ${buyer.name}`}><Trash2 size={16} /></button>}
                    </div>
                  )}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
