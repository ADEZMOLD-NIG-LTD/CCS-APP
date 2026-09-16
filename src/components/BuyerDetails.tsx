/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowLeft, ArrowUpRight, Download, Edit2, FileText, MapPin, Phone, Plus, Trash2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../contexts/AuthContext';
import { useCompanyCollection, useDerivedLevels, useWarehouses } from '../contexts/CompanyDataContext';
import { useBalanceGuard, useCommit } from '../hooks/useCommit';
import { AuditAction, auditOp } from '../lib/audit';
import { diffEffects, journalBuyerEffect, transactionBuyerEffect, transactionStockEffects } from '../lib/finance';
import { localDateToIso, todayLocal } from '../lib/dates';
import { pdfMoney } from '../services/reportService';
import { cn, formatCurrency, formatNumber, newId, roundTo, toNumber } from '../lib/utils';
import type { Buyer, JournalEntry, Transaction } from '../types';
import { DigitFormattedInput } from './DigitFormattedInput';
import ConfirmModal from './ConfirmModal';
import LedgerAdjustModal, { type AdjustTarget } from './ledger/LedgerAdjustModal';
import ReturnForm, { type ReturnInput } from './ledger/ReturnForm';

interface BuyerDetailsProps {
  buyer: Buyer;
  onBack: () => void;
}

interface Row {
  key: string;
  kind: 'TRANSACTION' | 'JOURNAL';
  date: string;
  postingDate?: string;
  description: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
  doc: Transaction | JournalEntry;
}

const field = 'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium';

export default function BuyerDetails({ buyer, onBack }: BuyerDetailsProps) {
  const { company, can, auditActor } = useAuth();
  const { commit, busy } = useCommit();
  const transactions = useCompanyCollection('transactions').data;
  const journal = useCompanyCollection('journal').data;
  const { data: warehouses } = useWarehouses();
  const { levels } = useDerivedLevels({ commodities: true });
  const guardFor = useBalanceGuard(levels);

  const [modal, setModal] = useState<null | 'return' | 'charge' | 'receipt'>(null);
  const [adjusting, setAdjusting] = useState<AdjustTarget | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);

  const ledger = useMemo(() => {
    const entries: Omit<Row, 'balance'>[] = [];
    for (const t of transactions) {
      if (t.isDeleted || t.buyerId !== buyer.id) continue;
      const effect = transactionBuyerEffect(t);
      if (!effect.debit && !effect.credit) continue;
      entries.push({
        key: `t-${t.id}`,
        kind: 'TRANSACTION',
        date: t.date,
        postingDate: t.postingDate,
        description: t.type === 'SALES_RETURN'
          ? `Sales return: ${t.commodity} (${formatNumber(t.netWeight)}kg)`
          : `${t.isDirectDelivery ? 'Direct delivery' : 'Sale'}: ${t.commodity} (${formatNumber(t.netWeight)}kg @ ${formatCurrency(t.pricePerKg || 0)})`,
        reference: t.referenceId,
        ...effect,
        doc: t,
      });
    }
    for (const j of journal) {
      if (j.isDeleted || j.buyerId !== buyer.id) continue;
      const effect = journalBuyerEffect(j);
      entries.push({
        key: `j-${j.id}`,
        kind: 'JOURNAL',
        date: j.date,
        postingDate: j.postingDate,
        description: j.type === 'OUTFLOW' ? `Charge: ${j.description}` : `Payment received: ${j.description}`,
        reference: j.reference || j.category,
        ...effect,
        doc: j,
      });
    }
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || new Date(a.postingDate || a.date).getTime() - new Date(b.postingDate || b.date).getTime());
    let running = toNumber(buyer.previousBalance);
    const rows: Row[] = entries.map(e => {
      running = roundTo(running + e.debit - e.credit, 2);
      return { ...e, balance: running };
    });
    return {
      rows,
      totalSales: roundTo(entries.reduce((s, e) => s + (e.kind === 'TRANSACTION' ? e.debit : 0), 0), 2),
      totalPayments: roundTo(entries.reduce((s, e) => s + (e.kind === 'JOURNAL' ? e.credit : 0), 0), 2),
      balance: running,
    };
  }, [transactions, journal, buyer]);

  if (!auditActor) return null;
  const actor = auditActor;
  const nowIso = () => new Date().toISOString();

  const recordReturn = async (input: ReturnInput) => {
    const id = newId();
    const record: Transaction = {
      id, companyId: actor.companyId, date: localDateToIso(input.date), postingDate: nowIso(), type: 'SALES_RETURN',
      commodity: input.commodity, buyerId: buyer.id, warehouseId: input.warehouseId, grossWeight: input.grossWeight,
      netWeight: input.netWeight, bags: input.bags, noOfBags: input.bags, pricePerKg: input.pricePerKg, totalValue: input.totalValue,
      referenceId: input.referenceId || `RET-${id.slice(0, 8).toUpperCase()}`, notes: input.notes, calculationMethod: 'MANUAL',
      deductions: { moistureActual: 0, moistureBenchmark: 0, tareWeight: 0, moldWeight: 0, otherDeduction: 0 }, createdByUid: actor.uid,
    };
    const ok = await commit(
      [
        { kind: 'set', collection: 'transactions', id, data: { ...record } },
        auditOp(actor, { action: AuditAction.CREATE, module: 'Sales Returns', recordId: id, details: `Sales return from ${buyer.name}: ${record.netWeight}kg ${record.commodity} (${formatCurrency(record.totalValue ?? 0)})`, newData: record }),
      ],
      { guard: guardFor(diffEffects([], transactionStockEffects(record))), success: 'Sales return recorded.', context: 'transactions' }
    );
    if (ok) setModal(null);
  };

  const recordJournal = async (kind: 'charge' | 'receipt', form: HTMLFormElement) => {
    const data = new FormData(form);
    const amount = roundTo(toNumber(data.get('amount')), 2);
    const warehouseId = String(data.get('warehouseId') ?? '');
    const description = String(data.get('description') ?? '').trim();
    if (amount <= 0 || !warehouseId || !description) return;
    const id = newId();
    const method = String(data.get('paymentMethod') ?? 'CASH');
    const entry: JournalEntry = {
      id,
      companyId: actor.companyId,
      warehouseId,
      date: localDateToIso(String(data.get('date') ?? todayLocal())),
      postingDate: nowIso(),
      buyerId: buyer.id,
      amount,
      type: kind === 'charge' ? 'OUTFLOW' : 'INFLOW',
      category: kind === 'charge' ? 'CUSTOMER_CHARGE' : 'PART_PAYMENT',
      description,
      reference: String(data.get('reference') ?? '').trim() || undefined,
      paymentMethod: kind === 'charge' ? undefined : method,
      // Charges are billed to the customer's account; receipts are money in the cash book.
      cashEffect: kind !== 'charge',
      excludeFromJournal: kind === 'charge' ? true : undefined,
      source: 'BUYER',
      createdByUid: actor.uid,
    };
    const ok = await commit(
      [
        { kind: 'set', collection: 'journal', id, data: { ...entry } },
        auditOp(actor, { action: AuditAction.CREATE, module: kind === 'charge' ? 'Customer Charges' : 'Customer Receipts', recordId: id, details: `${kind === 'charge' ? 'Charged' : 'Received from'} ${buyer.name}: ${formatCurrency(amount)}`, newData: entry }),
      ],
      { success: kind === 'charge' ? 'Charge recorded.' : 'Payment recorded.', context: 'journal' }
    );
    if (ok) setModal(null);
  };

  const saveAdjustment = async (updated: AdjustTarget) => {
    const collection = updated.kind === 'TRANSACTION' ? 'transactions' : 'journal';
    const previous = adjusting?.doc;
    const doc = { ...updated.doc, updatedAt: nowIso(), updatedByUid: actor.uid };
    const deltas = updated.kind === 'TRANSACTION' ? diffEffects(transactionStockEffects(previous as Transaction), transactionStockEffects(updated.doc)) : {};
    const ok = await commit(
      [
        { kind: 'set', collection, id: doc.id, data: { ...doc } },
        auditOp(actor, { action: AuditAction.UPDATE, module: collection === 'transactions' ? 'Transactions' : 'Journal', recordId: doc.id, details: `Adjusted ledger entry for ${buyer.name}`, previousData: previous, newData: doc }),
      ],
      { guard: guardFor(deltas), success: 'Entry updated.', context: collection }
    );
    if (ok) setAdjusting(null);
  };

  const deleteEntry = async (reason?: string) => {
    const row = deleting;
    if (!row || !reason?.trim()) return;
    const collection = row.kind === 'TRANSACTION' ? 'transactions' : 'journal';
    const deltas = row.kind === 'TRANSACTION' ? diffEffects(transactionStockEffects(row.doc as Transaction), []) : {};
    const ok = await commit(
      [
        { kind: 'update', collection, id: row.doc.id, data: { isDeleted: true, deletionReason: reason.trim(), deletedBy: actor.email, deletedByUid: actor.uid, deletedAt: nowIso() } },
        auditOp(actor, { action: AuditAction.DELETE, module: collection === 'transactions' ? 'Transactions' : 'Journal', recordId: row.doc.id, details: `Deleted "${row.description}" for ${buyer.name}. Reason: ${reason.trim()}`, previousData: row.doc }),
      ],
      { guard: guardFor(deltas), success: 'Entry deleted.', context: collection }
    );
    if (ok) setDeleting(null);
  };

  const exportPdf = () => {
    const pdf = new jsPDF('landscape');
    const width = pdf.internal.pageSize.getWidth();
    pdf.setFontSize(18);
    pdf.text((company?.name || 'CCS').toUpperCase(), width / 2, 16, { align: 'center' });
    pdf.setFontSize(12);
    pdf.text('CUSTOMER LEDGER STATEMENT', width / 2, 24, { align: 'center' });
    pdf.setFontSize(10);
    pdf.text(`Customer: ${buyer.name}   Phone: ${buyer.phone || 'N/A'}   Location: ${buyer.location || 'N/A'}`, 14, 34);
    pdf.text(`Generated ${new Date().toLocaleString()}   Closing balance: ${pdfMoney(Math.abs(ledger.balance))} (${ledger.balance >= 0 ? 'owes us' : 'we owe'})`, 14, 40);
    autoTable(pdf, {
      startY: 46,
      head: [['Date', 'Description', 'Reference', 'Debit', 'Credit', 'Balance']],
      body: [
        ['', 'Opening balance', '', '', '', pdfMoney(toNumber(buyer.previousBalance))],
        ...ledger.rows.map(r => [new Date(r.date).toLocaleDateString(), r.description, r.reference || '', r.debit ? pdfMoney(r.debit) : '-', r.credit ? pdfMoney(r.credit) : '-', pdfMoney(r.balance)]),
      ],
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 8, overflow: 'linebreak' },
    });
    pdf.save(`${buyer.name.replace(/[^\w]+/g, '_')}_ledger_${todayLocal()}.pdf`);
  };

  const canAdjust = can('adjust_ledger_entries');

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <ConfirmModal isOpen={!!deleting} title="Delete ledger entry" message={`Delete "${deleting?.description}"? Balances and stock are recalculated.`} confirmText="Delete" requireReason onConfirm={deleteEntry} onCancel={() => setDeleting(null)} />

      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full" aria-label="Back"><ArrowLeft size={20} className="text-slate-600" /></button>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-slate-900 truncate">{buyer.name}</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Customer ledger</p>
            </div>
          </div>
          <button onClick={exportPdf} className="bg-slate-900 text-white p-2 rounded-xl flex items-center gap-2 text-xs font-bold"><Download size={16} /> <span className="hidden sm:inline">Export PDF</span></button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100">
            <p className="text-[8px] font-bold text-blue-600 uppercase mb-1">Sales</p>
            <p className="text-sm font-black text-blue-900">{formatCurrency(ledger.totalSales)}</p>
          </div>
          <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
            <p className="text-[8px] font-bold text-emerald-600 uppercase mb-1">Payments</p>
            <p className="text-sm font-black text-emerald-900">{formatCurrency(ledger.totalPayments)}</p>
          </div>
          <div className={cn('p-3 rounded-2xl text-white', ledger.balance >= 0 ? 'bg-slate-900' : 'bg-rose-600')}>
            <p className="text-[8px] font-bold uppercase mb-1 opacity-70">{ledger.balance >= 0 ? 'Owes us' : 'We owe'}</p>
            <p className="text-sm font-black">{formatCurrency(Math.abs(ledger.balance))}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-2"><Phone size={14} /> {buyer.phone || 'N/A'}</span>
          <span className="flex items-center gap-2"><MapPin size={14} /> {buyer.location || 'N/A'}</span>
        </div>

        <div className="flex gap-2 flex-wrap">
          {can('create_trade') && <button onClick={() => setModal('return')} className="flex-1 min-w-[120px] bg-rose-50 text-rose-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-xs"><Plus size={16} /> Sales return</button>}
          {can('post_journal') && <button onClick={() => setModal('receipt')} className="flex-1 min-w-[120px] bg-emerald-50 text-emerald-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-xs"><Plus size={16} /> Payment received</button>}
          {can('post_journal') && <button onClick={() => setModal('charge')} className="flex-1 min-w-[120px] bg-amber-50 text-amber-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-xs"><Plus size={16} /> Charge customer</button>}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center text-xs">
            <span className="font-bold text-slate-900">Opening balance</span>
            <span className="font-black">{formatCurrency(toNumber(buyer.previousBalance))}</span>
          </div>
          {ledger.rows.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="mx-auto text-slate-200 mb-2" size={48} />
              <p className="text-sm text-slate-400">No transactions yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {[...ledger.rows].reverse().map(row => (
                <div key={row.key} className="p-4 flex justify-between items-start gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', row.debit ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600')}>
                      {row.debit ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900">{row.description}</p>
                      <p className="text-[10px] text-slate-400">{new Date(row.date).toLocaleDateString()} · {row.reference}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn('text-sm font-black', row.debit ? 'text-rose-600' : 'text-emerald-600')}>{row.debit ? `+${formatCurrency(row.debit)}` : `-${formatCurrency(row.credit)}`}</p>
                    <p className="text-[9px] text-slate-400">Balance {formatCurrency(row.balance)}</p>
                    {canAdjust && (
                      <div className="flex justify-end gap-2 mt-1">
                        <button onClick={() => setAdjusting(row.kind === 'TRANSACTION' ? { kind: 'TRANSACTION', doc: row.doc as Transaction } : { kind: 'JOURNAL', doc: row.doc as JournalEntry })} className="text-[10px] text-indigo-600 font-bold flex items-center gap-1"><Edit2 size={10} /> Adjust</button>
                        <button onClick={() => setDeleting(row)} className="text-[10px] text-rose-600 font-bold flex items-center gap-1"><Trash2 size={10} /> Delete</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {modal === 'return' && <ReturnForm kind="SALES_RETURN" warehouses={warehouses} busy={busy} onCancel={() => setModal(null)} onSubmit={recordReturn} />}

      {(modal === 'charge' || modal === 'receipt') && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl my-auto" role="dialog" aria-label={modal === 'charge' ? 'Charge customer' : 'Payment received'}>
            <h2 className={cn('text-xl font-bold mb-6', modal === 'charge' ? 'text-amber-600' : 'text-emerald-600')}>{modal === 'charge' ? 'Charge customer' : 'Payment received'}</h2>
            <form onSubmit={e => { e.preventDefault(); recordJournal(modal, e.currentTarget); }} className="space-y-4">
              <input type="date" name="date" required max={todayLocal()} defaultValue={todayLocal()} className={field} aria-label="Date" />
              <select name="warehouseId" required className={field} aria-label="Warehouse" defaultValue="">
                <option value="" disabled>Select warehouse</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <DigitFormattedInput name="amount" required className={field} prefix="₦" placeholder="Amount" aria-label="Amount" />
              {modal === 'receipt' && (
                <select name="paymentMethod" required className={field} aria-label="Payment method">
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank transfer</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              )}
              <input name="reference" maxLength={100} className={field} placeholder="Reference / receipt no. (optional)" aria-label="Reference" />
              <input name="description" required maxLength={300} className={field} placeholder={modal === 'charge' ? 'What is being charged' : 'Payment details'} aria-label="Description" />
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setModal(null)} className="flex-1 py-4 text-slate-500 font-bold text-sm">Cancel</button>
                <button type="submit" disabled={busy} className={cn('flex-1 text-white py-4 rounded-xl font-bold shadow-lg disabled:opacity-50 text-sm', modal === 'charge' ? 'bg-amber-600' : 'bg-emerald-600')}>
                  {busy ? 'Saving…' : 'Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {adjusting && <LedgerAdjustModal target={adjusting} busy={busy} onCancel={() => setAdjusting(null)} onSave={saveAdjustment} />}
    </div>
  );
}
