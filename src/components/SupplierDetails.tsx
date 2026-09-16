/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowLeft, ArrowUpRight, Calendar, Download, Edit2, FileText, Package, Plus, Trash2, Wallet } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../contexts/AuthContext';
import { useCompanyCollection, useDerivedLevels, useWarehouses } from '../contexts/CompanyDataContext';
import { useBalanceGuard, useCommit } from '../hooks/useCommit';
import { AuditAction, auditOp } from '../lib/audit';
import {
  bagStockEffects, diffEffects, journalSupplierEffect, levelFor, moistureLossKg, paymentSupplierEffect,
  supplierBagBalance, transactionStockEffects, transactionSupplierEffect,
} from '../lib/finance';
import { isoToLocalDate, localDateToIso, todayLocal } from '../lib/dates';
import { cn, formatCurrency, formatNumber, newId, roundTo, toNumber } from '../lib/utils';
import { pdfMoney } from '../services/reportService';
import type { BagTransaction, JournalEntry, PackagingType, Payment, Supplier, Transaction } from '../types';
import { DigitFormattedInput } from './DigitFormattedInput';
import ConfirmModal from './ConfirmModal';
import LedgerAdjustModal, { type AdjustTarget } from './ledger/LedgerAdjustModal';
import ReturnForm, { type ReturnInput } from './ledger/ReturnForm';

interface Props {
  supplier: Supplier;
  onBack: () => void;
}

type Kind = 'TRANSACTION' | 'PAYMENT' | 'JOURNAL';

interface Row {
  key: string;
  kind: Kind;
  date: string;
  postingDate?: string;
  description: string;
  reference: string;
  credit: number;
  debit: number;
  balance: number;
  doc: Transaction | Payment | JournalEntry;
}

const field = 'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium';

function describe(t: Transaction): string {
  const kg = `${formatNumber(t.netWeight || 0)}kg`;
  if (t.type === 'PURCHASE_RETURN') return `Purchase return: ${t.commodity} (${kg})`;
  if (t.type === 'SALE') return t.isDirectDelivery ? `Direct delivery to buyer: ${t.commodity} (${kg})` : `Sale to supplier: ${t.commodity} (${kg})`;
  return `Purchase: ${t.commodity} (${kg})`;
}

export default function SupplierDetails({ supplier, onBack }: Props) {
  const { company, can, auditActor } = useAuth();
  const { commit, busy } = useCommit();
  const transactions = useCompanyCollection('transactions').data;
  const payments = useCompanyCollection('payments').data;
  const journal = useCompanyCollection('journal').data;
  const bagTransactions = useCompanyCollection('bag_transactions').data;
  const { data: warehouses } = useWarehouses();
  const { levels } = useDerivedLevels({ commodities: true, bags: true });
  const guardFor = useBalanceGuard(levels);

  const [tab, setTab] = useState<'ledger' | 'bags' | 'payments'>('ledger');
  const [startDate, setStartDate] = useState(`${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(todayLocal());
  const [modal, setModal] = useState<null | 'return' | 'charge' | 'deduction' | 'payment' | 'bags'>(null);
  const [adjusting, setAdjusting] = useState<AdjustTarget | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);

  const ledger = useMemo(() => {
    const entries: Omit<Row, 'balance'>[] = [];
    for (const t of transactions) {
      if (t.isDeleted || t.supplierId !== supplier.id) continue;
      const e = transactionSupplierEffect(t);
      if (!e.credit && !e.debit) continue;
      entries.push({ key: `t-${t.id}`, kind: 'TRANSACTION', date: t.date, postingDate: t.postingDate, description: describe(t), reference: t.referenceId, ...e, doc: t });
    }
    for (const p of payments) {
      if (p.isDeleted || p.supplierId !== supplier.id) continue;
      entries.push({ key: `p-${p.id}`, kind: 'PAYMENT', date: p.date, postingDate: p.postingDate, description: `Payment (${p.method.replace('_', ' ').toLowerCase()}): ${p.description}`, reference: p.reference, ...paymentSupplierEffect(p), doc: p });
    }
    for (const j of journal) {
      if (j.isDeleted || j.supplierId !== supplier.id) continue;
      const label = j.category === 'SUPPLIER_EXPENSE_DEDUCTION' ? 'Expense deduction' : j.type === 'INFLOW' ? 'Refund / reversal' : 'Charge';
      entries.push({ key: `j-${j.id}`, kind: 'JOURNAL', date: j.date, postingDate: j.postingDate, description: `${label}: ${j.description}`, reference: j.reference || j.category, ...journalSupplierEffect(j), doc: j });
    }
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || new Date(a.postingDate || a.date).getTime() - new Date(b.postingDate || b.date).getTime());

    let running = toNumber(supplier.previousBalance);
    let broughtForward = running;
    const rows: Row[] = [];
    for (const e of entries) {
      running = roundTo(running + e.credit - e.debit, 2);
      const day = isoToLocalDate(e.date);
      if (day < startDate) broughtForward = running;
      else if (day <= endDate) rows.push({ ...e, balance: running });
    }
    const currentBalance = running;
    return {
      rows,
      broughtForward,
      currentBalance,
      totalCredit: roundTo(rows.reduce((s, r) => s + r.credit, 0), 2),
      totalDebit: roundTo(rows.reduce((s, r) => s + r.debit, 0), 2),
    };
  }, [transactions, payments, journal, supplier, startDate, endDate]);

  const supplierBags = useMemo(() => bagTransactions.filter(b => !b.isDeleted && b.supplierId === supplier.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [bagTransactions, supplier.id]);
  const supplierPayments = useMemo(() => payments.filter(p => !p.isDeleted && p.supplierId === supplier.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [payments, supplier.id]);
  const bagBalance = useMemo(() => supplierBagBalance(bagTransactions, supplier.id), [bagTransactions, supplier.id]);

  if (!auditActor) return null;
  const actor = auditActor;
  const nowIso = () => new Date().toISOString();

  const recordReturn = async (input: ReturnInput) => {
    const id = newId();
    const record: Transaction = {
      id, companyId: actor.companyId, date: localDateToIso(input.date), postingDate: nowIso(), type: 'PURCHASE_RETURN',
      commodity: input.commodity, supplierId: supplier.id, warehouseId: input.warehouseId, grossWeight: input.grossWeight,
      netWeight: input.netWeight, bags: input.bags, noOfBags: input.bags, pricePerKg: input.pricePerKg, totalValue: input.totalValue,
      referenceId: input.referenceId || `RET-${id.slice(0, 8).toUpperCase()}`, notes: input.notes, calculationMethod: 'MANUAL',
      deductions: { moistureActual: 0, moistureBenchmark: 0, tareWeight: 0, moldWeight: 0, otherDeduction: 0 }, createdByUid: actor.uid,
    };
    const ok = await commit(
      [
        { kind: 'set', collection: 'transactions', id, data: { ...record } },
        auditOp(actor, { action: AuditAction.CREATE, module: 'Purchase Returns', recordId: id, details: `Purchase return to ${supplier.name}: ${record.netWeight}kg ${record.commodity} (${formatCurrency(record.totalValue ?? 0)})`, newData: record }),
      ],
      { guard: guardFor(diffEffects([], transactionStockEffects(record))), success: 'Purchase return recorded.', context: 'transactions' }
    );
    if (ok) setModal(null);
  };

  const recordMoney = async (kind: 'charge' | 'deduction' | 'payment', form: HTMLFormElement) => {
    const data = new FormData(form);
    const amount = roundTo(toNumber(data.get('amount')), 2);
    const warehouseId = String(data.get('warehouseId') ?? '');
    const description = String(data.get('description') ?? '').trim();
    const date = localDateToIso(String(data.get('date') ?? todayLocal()));
    const reference = String(data.get('reference') ?? '').trim();
    if (amount <= 0 || !warehouseId || !description) return;
    const id = newId();

    if (kind === 'payment') {
      const payment: Payment = {
        id, companyId: actor.companyId, warehouseId, date, postingDate: nowIso(), supplierId: supplier.id, amount,
        method: String(data.get('method') ?? 'CASH') as Payment['method'], reference,
        description: `${data.get('isAdvance') === 'on' ? '[ADVANCE] ' : ''}${description}`, createdByUid: actor.uid,
      };
      const ok = await commit(
        [
          { kind: 'set', collection: 'payments', id, data: { ...payment } },
          auditOp(actor, { action: AuditAction.CREATE, module: 'Payments', recordId: id, details: `Paid ${formatCurrency(amount)} to ${supplier.name}`, newData: payment }),
        ],
        { success: 'Payment recorded and posted to the cash book.', context: 'payments' }
      );
      if (ok) setModal(null);
      return;
    }

    const entry: JournalEntry = {
      id,
      companyId: actor.companyId,
      warehouseId,
      date,
      postingDate: nowIso(),
      type: kind === 'charge' ? 'OUTFLOW' : 'INFLOW',
      category: kind === 'charge' ? 'SUPPLIER_CHARGE' : 'SUPPLIER_EXPENSE_DEDUCTION',
      amount,
      description: kind === 'deduction' ? `${data.get('deductionType')}${description ? ` - ${description}` : ''}` : description,
      reference: reference || undefined,
      supplierId: supplier.id,
      // Charges and deductions change what is owed; they do not move cash.
      cashEffect: false,
      excludeFromJournal: true,
      source: 'SUPPLIER',
      createdByUid: actor.uid,
    };
    const ok = await commit(
      [
        { kind: 'set', collection: 'journal', id, data: { ...entry } },
        auditOp(actor, { action: AuditAction.CREATE, module: kind === 'charge' ? 'Supplier Charges' : 'Supplier Expense Deductions', recordId: id, details: `${kind === 'charge' ? 'Charged' : 'Credited'} ${supplier.name} ${formatCurrency(amount)}: ${entry.description}`, newData: entry }),
      ],
      { success: kind === 'charge' ? 'Charge recorded.' : 'Deduction recorded.', context: 'journal' }
    );
    if (ok) setModal(null);
  };

  const recordBags = async (form: HTMLFormElement) => {
    const data = new FormData(form);
    const quantity = Math.round(toNumber(data.get('quantity')));
    const warehouseId = String(data.get('warehouseId') ?? '');
    const type = String(data.get('type')) as 'ISSUE' | 'RETURN';
    const packagingType = String(data.get('packagingType')) as PackagingType;
    if (quantity <= 0 || !warehouseId) return;
    const id = newId();
    const record: BagTransaction = {
      id, companyId: actor.companyId, date: nowIso(), supplierId: supplier.id, type, packagingType, warehouseId, quantity,
      reference: String(data.get('reference') ?? '').trim() || `BAG-${id.slice(0, 8).toUpperCase()}`, createdByUid: actor.uid,
    };
    const ok = await commit(
      [
        { kind: 'set', collection: 'bag_transactions', id, data: { ...record } },
        auditOp(actor, { action: AuditAction.CREATE, module: 'Bag Transactions', recordId: id, details: `${type === 'ISSUE' ? 'Issued' : 'Received back'} ${quantity} ${packagingType.replace('_', ' ')} ${type === 'ISSUE' ? 'to' : 'from'} ${supplier.name}`, newData: record }),
      ],
      { guard: guardFor(diffEffects([], bagStockEffects(record))), success: 'Bag movement recorded.', context: 'bag_transactions' }
    );
    if (ok) setModal(null);
  };

  const collectionFor = (kind: Kind) => (kind === 'TRANSACTION' ? 'transactions' : kind === 'PAYMENT' ? 'payments' : 'journal');

  const saveAdjustment = async (updated: AdjustTarget) => {
    const collection = collectionFor(updated.kind);
    const previous = adjusting?.doc;
    const docData = { ...updated.doc, updatedAt: nowIso(), updatedByUid: actor.uid };
    const deltas = updated.kind === 'TRANSACTION' ? diffEffects(transactionStockEffects(previous as Transaction), transactionStockEffects(updated.doc)) : {};
    const ok = await commit(
      [
        { kind: 'set', collection, id: docData.id, data: { ...docData } },
        auditOp(actor, { action: AuditAction.UPDATE, module: collection, recordId: docData.id, details: `Adjusted ledger entry for ${supplier.name}`, previousData: previous, newData: docData }),
      ],
      { guard: guardFor(deltas), success: 'Entry updated.', context: collection }
    );
    if (ok) setAdjusting(null);
  };

  const deleteEntry = async (reason?: string) => {
    const row = deleting;
    if (!row || !reason?.trim()) return;
    const collection = collectionFor(row.kind);
    const deltas = row.kind === 'TRANSACTION' ? diffEffects(transactionStockEffects(row.doc as Transaction), []) : {};
    const ok = await commit(
      [
        { kind: 'update', collection, id: row.doc.id, data: { isDeleted: true, deletionReason: reason.trim(), deletedBy: actor.email, deletedByUid: actor.uid, deletedAt: nowIso() } },
        auditOp(actor, { action: AuditAction.DELETE, module: collection, recordId: row.doc.id, details: `Deleted "${row.description}" for ${supplier.name}. Reason: ${reason.trim()}`, previousData: row.doc }),
      ],
      { guard: guardFor(deltas), success: 'Entry deleted.', context: collection }
    );
    if (ok) setDeleting(null);
  };

  const exportPdf = () => {
    const pdf = new jsPDF('landscape');
    pdf.setFontSize(18);
    pdf.text((company?.name || 'CCS').toUpperCase(), 148, 16, { align: 'center' });
    pdf.setFontSize(12);
    pdf.text('SUPPLIER LEDGER STATEMENT', 148, 24, { align: 'center' });
    pdf.setFontSize(10);
    pdf.text(`Supplier: ${supplier.name}   Phone: ${supplier.phone || 'N/A'}   Location: ${supplier.location || 'N/A'}`, 15, 34);
    pdf.text(`Period: ${startDate} to ${endDate}   Current balance: ${pdfMoney(Math.abs(ledger.currentBalance))} (${ledger.currentBalance >= 0 ? 'we owe' : 'owes us'})`, 15, 40);
    autoTable(pdf, {
      startY: 46,
      head: [['Date', 'Description', 'Bags', 'Gross', 'Deductions', 'Net', 'Price', 'Credit', 'Debit', 'Balance']],
      body: [
        [startDate, 'Balance brought forward', '', '', '', '', '', '', '', pdfMoney(ledger.broughtForward)],
        ...ledger.rows.map(r => {
          const t = r.kind === 'TRANSACTION' ? (r.doc as Transaction) : null;
          const moisture = t?.deductions ? moistureLossKg(t.deductions.moistureActual, t.deductions.moistureBenchmark, t.grossWeight) : 0;
          return [
            new Date(r.date).toLocaleDateString(),
            r.description,
            t ? String(t.noOfBags ?? t.bags ?? '') : '',
            t ? `${formatNumber(t.grossWeight)}kg` : '',
            t ? `${formatNumber(Math.max(0, t.grossWeight - t.netWeight))}kg${moisture ? ` (M ${formatNumber(moisture)})` : ''}` : '',
            t ? `${formatNumber(t.netWeight)}kg` : '',
            t?.pricePerKg ? pdfMoney(t.pricePerKg) : '',
            r.credit ? pdfMoney(r.credit) : '-',
            r.debit ? pdfMoney(r.debit) : '-',
            pdfMoney(r.balance),
          ];
        }),
      ],
      foot: [['TOTAL', '', '', '', '', '', '', pdfMoney(ledger.totalCredit), pdfMoney(ledger.totalDebit), pdfMoney(ledger.rows.at(-1)?.balance ?? ledger.broughtForward)]],
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], fontSize: 7.5 },
      footStyles: { fillColor: [243, 244, 246], textColor: [31, 41, 55], fontSize: 7.5 },
      styles: { fontSize: 7, cellPadding: 1.2, overflow: 'linebreak' },
    });
    pdf.save(`${supplier.name.replace(/[^\w]+/g, '_')}_ledger_${todayLocal()}.pdf`);
  };

  const canAdjust = can('adjust_ledger_entries');
  const moneyModal = modal === 'charge' || modal === 'deduction' || modal === 'payment';

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <ConfirmModal isOpen={!!deleting} title="Delete ledger entry" message={`Delete "${deleting?.description}"? Balances and stock are recalculated.`} confirmText="Delete" requireReason onConfirm={deleteEntry} onCancel={() => setDeleting(null)} />

      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-20">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="p-2 -ml-2 text-slate-400 hover:text-slate-900" aria-label="Back"><ArrowLeft size={20} /></button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-900 truncate">{supplier.name}</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">{supplier.location}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
            <p className="text-[9px] font-bold text-emerald-600 uppercase mb-1">{ledger.currentBalance >= 0 ? 'We owe' : 'Owes us'}</p>
            <p className={cn('text-lg font-black', ledger.currentBalance >= 0 ? 'text-emerald-700' : 'text-rose-700')}>{formatCurrency(Math.abs(ledger.currentBalance))}</p>
          </div>
          <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100">
            <p className="text-[9px] font-bold text-blue-600 uppercase mb-1">Bags held by supplier</p>
            <p className="text-lg font-black text-blue-700">{formatNumber(bagBalance, 0)}</p>
          </div>
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {([['ledger', FileText, 'Ledger'], ['bags', Package, 'Bags'], ['payments', Wallet, 'Payments']] as const).map(([id, Icon, label]) => (
            <button key={id} onClick={() => setTab(id)} className={cn('flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold', tab === id ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400')}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
        {tab === 'ledger' && (
          <>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[8px] font-bold text-slate-400 uppercase flex items-center gap-1"><Calendar size={10} /> From</span>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs" />
              </label>
              <label className="block">
                <span className="text-[8px] font-bold text-slate-400 uppercase">To</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs" />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {can('create_trade') && <button onClick={() => setModal('return')} className="text-xs font-black text-rose-600 bg-rose-50 py-2.5 rounded-xl border border-rose-200 flex items-center justify-center gap-1"><Plus size={14} /> Purchase return</button>}
              {can('record_supplier_payment') && <button onClick={() => setModal('charge')} className="text-xs font-black text-amber-600 bg-amber-50 py-2.5 rounded-xl border border-amber-200 flex items-center justify-center gap-1"><Plus size={14} /> Charge</button>}
              {can('record_supplier_payment') && <button onClick={() => setModal('deduction')} className="text-xs font-black text-indigo-600 bg-indigo-50 py-2.5 rounded-xl border border-indigo-200 flex items-center justify-center gap-1"><Plus size={14} /> Expense deduction</button>}
            </div>

            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Transactions</h2>
              <button onClick={exportPdf} className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg"><Download size={14} /> PDF</button>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-900 rounded-2xl text-white">
              <div>
                <p className="text-[10px] font-bold uppercase opacity-60">Balance brought forward</p>
                <p className="text-[8px] opacity-40 uppercase">As at {startDate}</p>
              </div>
              <p className="text-lg font-black">{formatCurrency(ledger.broughtForward)}</p>
            </div>

            {[...ledger.rows].reverse().map(row => {
              const t = row.kind === 'TRANSACTION' ? (row.doc as Transaction) : null;
              const moisture = t?.deductions ? moistureLossKg(t.deductions.moistureActual, t.deductions.moistureBenchmark, t.grossWeight) : 0;
              return (
                <div key={row.key} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-start gap-3">
                  <div className="flex gap-3 min-w-0">
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', row.credit ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600')}>
                      {row.credit ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900">{row.description}</p>
                      <p className="text-[10px] text-slate-400">{new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} · {row.reference}</p>
                      {t && (
                        <p className="text-[9px] text-slate-500 mt-1">
                          Gross {formatNumber(t.grossWeight)}kg · Net {formatNumber(t.netWeight)}kg{moisture ? ` · Moisture ${formatNumber(moisture)}kg` : ''}{t.pricePerKg ? ` · ${formatCurrency(t.pricePerKg)}/kg` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn('text-base font-black', row.credit ? 'text-emerald-600' : 'text-rose-600')}>{row.credit ? '+' : '-'}{formatCurrency(row.credit || row.debit)}</p>
                    <p className="text-[9px] text-slate-500">Balance {formatCurrency(row.balance)}</p>
                    {canAdjust && (
                      <div className="flex justify-end gap-2 mt-1">
                        <button onClick={() => setAdjusting({ kind: row.kind, doc: row.doc } as AdjustTarget)} className="text-[10px] text-emerald-600 font-black flex items-center gap-1"><Edit2 size={10} /> Adjust</button>
                        <button onClick={() => setDeleting(row)} className="text-[10px] text-rose-600 font-black flex items-center gap-1"><Trash2 size={10} /> Delete</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {ledger.rows.length === 0 && <p className="text-center text-xs text-slate-400 py-8">No entries in this period.</p>}
          </>
        )}

        {tab === 'bags' && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Bag tracking</h2>
              {can('record_bags') && <button onClick={() => setModal('bags')} className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg"><Plus size={14} /> Issue / return</button>}
            </div>
            {supplierBags.map(bt => (
              <div key={bt.id} className="bg-white p-4 rounded-2xl border border-slate-200 flex justify-between items-center">
                <div>
                  <p className="text-sm font-bold text-slate-900">{bt.type === 'ISSUE' ? 'Issued' : bt.type === 'RETURN' ? 'Returned' : bt.type.replace('_', ' ')} · {bt.packagingType.replace('_', ' ')}</p>
                  <p className="text-[10px] text-slate-400">{new Date(bt.date).toLocaleDateString()} · Ref: {bt.reference}</p>
                </div>
                <p className={cn('text-lg font-black', bt.type === 'ISSUE' ? 'text-blue-600' : 'text-slate-600')}>{bt.type === 'ISSUE' ? '+' : '-'}{formatNumber(bt.quantity, 0)}</p>
              </div>
            ))}
            {supplierBags.length === 0 && <p className="text-center text-xs text-slate-400 py-8">No bag movements.</p>}
          </>
        )}

        {tab === 'payments' && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Payments</h2>
              {can('record_supplier_payment') && <button onClick={() => setModal('payment')} className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg"><Plus size={14} /> New payment</button>}
            </div>
            {supplierPayments.map(p => (
              <div key={p.id} className="bg-white p-4 rounded-2xl border border-slate-200 flex justify-between items-start">
                <div>
                  <p className="text-sm font-bold text-slate-900">{p.method.replace('_', ' ')}</p>
                  <p className="text-[10px] text-slate-400">{new Date(p.date).toLocaleDateString()} · {p.description}</p>
                </div>
                <p className="text-lg font-black text-emerald-600">{formatCurrency(p.amount)}</p>
              </div>
            ))}
            {supplierPayments.length === 0 && <p className="text-center text-xs text-slate-400 py-8">No payments yet.</p>}
          </>
        )}
      </main>

      {modal === 'return' && (
        <ReturnForm kind="PURCHASE_RETURN" warehouses={warehouses} available={(w, c) => levelFor(levels, 'COMMODITY', w, c)} busy={busy} onCancel={() => setModal(null)} onSubmit={recordReturn} />
      )}

      {moneyModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl my-auto" role="dialog">
            <h2 className="text-xl font-bold mb-2">{modal === 'payment' ? 'Record payment' : modal === 'charge' ? 'Charge supplier' : 'Expense deduction'}</h2>
            <p className="text-xs text-slate-500 mb-5">
              {modal === 'payment' ? 'Money paid to the supplier. Posted to the cash book.' : modal === 'charge' ? 'Reduces what you owe the supplier. Does not move cash.' : 'Adds to what you owe the supplier (costs they paid on your behalf). Does not move cash.'}
            </p>
            <form onSubmit={e => { e.preventDefault(); recordMoney(modal as 'charge' | 'deduction' | 'payment', e.currentTarget); }} className="space-y-4">
              <input type="date" name="date" required max={todayLocal()} defaultValue={todayLocal()} className={field} aria-label="Date" />
              <select name="warehouseId" required defaultValue="" className={field} aria-label="Warehouse">
                <option value="" disabled>Select warehouse</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              {modal === 'deduction' && (
                <select name="deductionType" required className={field} aria-label="Deduction type">
                  {['Transportation charges', 'Jute / nylon expenses', 'Loading expense', 'Offloading expense', 'Quality charges', 'Storage charges', 'Advance recovery', 'Others'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              )}
              <DigitFormattedInput name="amount" required className={field} prefix="₦" placeholder="Amount" aria-label="Amount" />
              {modal === 'payment' && (
                <select name="method" required className={field} aria-label="Payment method">
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank transfer</option>
                  <option value="CHECK">Cheque</option>
                </select>
              )}
              <input name="description" required={modal !== 'deduction'} maxLength={300} className={field} placeholder="Description" aria-label="Description" />
              <input name="reference" maxLength={100} className={field} placeholder="Reference (optional)" aria-label="Reference" />
              {modal === 'payment' && (
                <label className="flex items-center gap-2 bg-emerald-50 p-3 rounded-xl border border-emerald-100 text-xs font-bold text-emerald-700">
                  <input type="checkbox" name="isAdvance" className="w-4 h-4 accent-emerald-600" /> Advance payment
                </label>
              )}
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setModal(null)} className="flex-1 py-4 text-slate-500 font-bold text-sm">Cancel</button>
                <button type="submit" disabled={busy} className="flex-1 bg-emerald-600 text-white py-4 rounded-xl font-bold shadow-lg disabled:opacity-50 text-sm">{busy ? 'Saving…' : 'Record'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === 'bags' && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl" role="dialog">
            <h2 className="text-xl font-bold mb-6">Bag issue / return</h2>
            <form onSubmit={e => { e.preventDefault(); recordBags(e.currentTarget); }} className="space-y-4">
              <select name="type" required className={field} aria-label="Type">
                <option value="ISSUE">Issue bags to supplier</option>
                <option value="RETURN">Bags returned by supplier</option>
              </select>
              <select name="warehouseId" required defaultValue="" className={field} aria-label="Warehouse">
                <option value="" disabled>Select warehouse</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <select name="packagingType" required className={field} aria-label="Bag type">
                <option value="JUTE_BAG">Jute bag</option>
                <option value="NYLON_BAG">Nylon bag</option>
              </select>
              <input name="quantity" type="number" min={1} step={1} required className={field} placeholder="Quantity" aria-label="Quantity" />
              <input name="reference" maxLength={60} className={field} placeholder="Reference (optional)" aria-label="Reference" />
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setModal(null)} className="flex-1 py-4 text-slate-500 font-bold">Cancel</button>
                <button type="submit" disabled={busy} className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg disabled:opacity-50">{busy ? 'Saving…' : 'Confirm'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {adjusting && <LedgerAdjustModal target={adjusting} busy={busy} onCancel={() => setAdjusting(null)} onSave={saveAdjustment} />}
    </div>
  );
}
