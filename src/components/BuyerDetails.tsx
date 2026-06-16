/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  Download, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Calendar, 
  Search,
  Filter,
  FileText,
  Phone,
  MapPin,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Edit2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Buyer, Transaction, JournalEntry, Warehouse, CommodityType } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { db } from '../firebase';
import { collection, onSnapshot, query, where, orderBy, doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { reportFirestoreError, OperationType } from '../lib/firestore';
import { recordAuditLog, AuditAction } from '../lib/audit';
import { DigitFormattedInput } from './DigitFormattedInput';
import Toast from './Toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { roundTo, formatNumber, formatCurrency } from '../lib/utils';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface BuyerDetailsProps {
  buyer: Buyer;
  onBack: () => void;
}

export default function BuyerDetails({ buyer, onBack }: BuyerDetailsProps) {
  const { profile, isStaff, isAccount, isAdmin, isOnline, canPostTransactions, errorMessage, setErrorMessage } = useAuth();
  const [sales, setSales] = useState<Transaction[]>([]);
  const [payments, setPayments] = useState<JournalEntry[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'THIS_MONTH' | 'LAST_MONTH'>('ALL');

  const [isAddingSalesReturn, setIsAddingSalesReturn] = useState(false);
  const [isAddingCustomerCharge, setIsAddingCustomerCharge] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [returnNetWeight, setReturnNetWeight] = useState<string>('');
  const [returnPricePerKg, setReturnPricePerKg] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Success message auto-hide
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (!profile?.companyId || !buyer.id) return;

    // Load Sales & Sales Returns
    const qSales = query(
      collection(db, 'transactions'),
      where('companyId', '==', profile.companyId),
      where('buyerId', '==', buyer.id)
    );
    const unsubscribeSales = onSnapshot(qSales, (snapshot) => {
      const data = snapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id } as Transaction))
        .filter(t => !t.isDeleted && (t.type === 'SALE' || (t.type as string) === 'SALES_RETURN'));
      const sorted = data.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      setSales(sorted);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'transactions')));

    // Load Payments and Charges (Journal entries linked to this buyer)
    const qPayments = query(
      collection(db, 'journal'),
      where('companyId', '==', profile.companyId),
      where('buyerId', '==', buyer.id)
    );
    const unsubscribePayments = onSnapshot(qPayments, (snapshot) => {
      const data = snapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id } as JournalEntry))
        .filter(e => !e.isDeleted);
      const sorted = data.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      setPayments(sorted);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'journal')));

    // Load Warehouses
    const qWarehouses = query(
      collection(db, 'warehouses'),
      where('companyId', '==', profile.companyId)
    );
    const unsubscribeWarehouses = onSnapshot(qWarehouses, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Warehouse));
      setWarehouses(data);
    });

    return () => {
      unsubscribeSales();
      unsubscribePayments();
      unsubscribeWarehouses();
    };
  }, [profile?.companyId, buyer.id]);

  const handleAddSalesReturn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canPostTransactions || submitting || !profile?.companyId) return;

    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const id = crypto.randomUUID();
    const selectedDate = formData.get('date') as string;
    const transactionDateIso = selectedDate 
      ? new Date(selectedDate + 'T12:00:00').toISOString() 
      : new Date().toISOString();

    const newTx: any = {
      id,
      companyId: profile.companyId,
      date: transactionDateIso,
      postingDate: new Date().toISOString(),
      type: 'SALES_RETURN',
      commodity: formData.get('commodity') as CommodityType,
      buyerId: buyer.id,
      warehouseId: formData.get('warehouseId') as string,
      grossWeight: Number(formData.get('grossWeight') || 0),
      netWeight: Number(formData.get('netWeight') || 0),
      bags: Number(formData.get('bags') || 0),
      pricePerKg: Number(formData.get('pricePerKg') || 0),
      totalValue: Number(formData.get('totalValue') || 0),
      referenceId: formData.get('referenceId') as string || `RET-${Date.now().toString().slice(-6)}`,
      notes: formData.get('notes') as string || '',
      deductions: {
        moistureActual: 8,
        moistureBenchmark: 8,
        tareWeight: 0,
        moldWeight: 0,
        otherDeduction: 0
      }
    };

    try {
      const writePromise = setDoc(doc(db, 'transactions', id), newTx);
      
      if (!isOnline) {
        console.log('Working offline, proceeding optimistically');
      } else {
        await writePromise;
      }
      
      recordAuditLog({
        companyId: profile.companyId,
        userId: profile.uid,
        userEmail: profile.email,
        action: AuditAction.CREATE,
        module: 'Sales Returns',
        recordId: id,
        details: `Recorded sales return of ${newTx.commodity} (${formatNumber(newTx.netWeight)}kg) valued at ${formatCurrency(newTx.totalValue)} for customer ${buyer.name}`,
        newData: newTx
      }).catch(err => console.error('Audit log failed:', err));

      setIsAddingSalesReturn(false);
      setSuccessMessage('Sales return successfully recorded!');
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, OperationType.CREATE, `transactions/${id}`));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddCustomerCharge = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!(isAccount || isAdmin) || submitting || !profile?.companyId) return;

    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const id = crypto.randomUUID();
    const selectedDate = formData.get('date') as string;
    const transactionDateIso = selectedDate 
      ? new Date(selectedDate + 'T12:00:00').toISOString() 
      : new Date().toISOString();

    const newEntry: any = {
      id,
      companyId: profile.companyId,
      warehouseId: formData.get('warehouseId') as string,
      date: transactionDateIso,
      postingDate: new Date().toISOString(),
      type: 'OUTFLOW',
      category: 'CUSTOMER_CHARGE',
      amount: Number(formData.get('amount')),
      description: formData.get('description') as string,
      buyerId: buyer.id,
      paymentMethod: formData.get('paymentMethod') as any,
      excludeFromJournal: true
    };

    try {
      const writePromise = setDoc(doc(db, 'journal', id), newEntry);
      
      if (!isOnline) {
        console.log('Working offline, proceeding optimistically');
      } else {
        await writePromise;
      }
      
      recordAuditLog({
        companyId: profile.companyId,
        userId: profile.uid,
        userEmail: profile.email,
        action: AuditAction.CREATE,
        module: 'Customer Charges',
        recordId: id,
        details: `Recorded customer charge: ${newEntry.description} of amount ${formatCurrency(newEntry.amount)} for customer ${buyer.name}`,
        newData: newEntry
      }).catch(err => console.error('Audit log failed:', err));

      setIsAddingCustomerCharge(false);
      setSuccessMessage('Customer charge successfully recorded!');
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, OperationType.CREATE, `journal/${id}`));
    } finally {
      setSubmitting(false);
    }
  };

  const ledgerEntries = useMemo(() => {
    const entries = [
      ...sales.map(s => ({
        id: s.id,
        date: s.date,
        type: s.type,
        description: (s.type as string) === 'SALES_RETURN'
          ? `Sales Return: ${s.commodity} (${formatNumber(s.netWeight || 0)}kg)`
          : (s.isDirectDelivery 
            ? `Direct Delivery: ${s.commodity} (${formatNumber(s.netWeight || 0)}kg @ ${formatCurrency(s.pricePerKg || 0)})`
            : `${s.commodity} Sale (${formatNumber(s.netWeight || 0)}kg @ ${formatCurrency(s.pricePerKg || 0)})`),
        debit: s.type === 'SALE' ? roundTo(s.totalValue || 0, 2) : 0,
        credit: (s.type as string) === 'SALES_RETURN' ? roundTo(s.totalValue || 0, 2) : 0,
        reference: s.referenceId
      })),
      ...payments.map(p => ({
        id: p.id,
        date: p.date,
        type: 'PAYMENT' as const,
        description: p.type === 'OUTFLOW' 
          ? `Customer Charge: ${p.category} ${p.description ? '- ' + p.description : ''}`
          : (p.description || 'Cash Payment'),
        debit: p.type === 'OUTFLOW' ? roundTo(p.amount || 0, 2) : 0,
        credit: p.type === 'INFLOW' ? roundTo(p.amount || 0, 2) : 0,
        reference: p.category
      }))
    ];

    return entries.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  }, [sales, payments]);

  const stats = useMemo(() => {
    const totalSales = sales.filter(s => s.type === 'SALE').reduce((sum, s) => sum + roundTo(s.totalValue || 0, 2), 0);
    const totalReturns = sales.filter(s => (s.type as string) === 'SALES_RETURN').reduce((sum, s) => sum + roundTo(s.totalValue || 0, 2), 0);
    const totalPayments = payments.filter(p => p.type === 'INFLOW').reduce((sum, p) => sum + roundTo(p.amount || 0, 2), 0);
    const totalCharges = payments.filter(p => p.type === 'OUTFLOW').reduce((sum, p) => sum + roundTo(p.amount || 0, 2), 0);
    const currentBalance = roundTo((buyer.previousBalance || 0) + totalSales - totalReturns + totalCharges - totalPayments, 2);

    return { totalSales, totalPayments, currentBalance, totalReturns, totalCharges };
  }, [sales, payments, buyer.previousBalance]);

  const exportPDF = () => {
    const doc = new jsPDF('landscape');
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42);
    doc.text('CUSTOMER LEDGER REPORT', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, pageWidth / 2, 28, { align: 'center' });

    // Buyer Info Box
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.rect(14, 35, pageWidth - 28, 30, 'F');
    
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text((buyer.name || 'UNKNOWN').toUpperCase(), 20, 45);
    
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Phone: ${buyer.phone || 'N/A'}`, 20, 52);
    doc.text(`Location: ${buyer.location || 'N/A'}`, 20, 58);

    // Summary Stats in PDF
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('SUMMARY', pageWidth - 80, 45);
    doc.setFontSize(9);
    doc.text(`Opening Balance: ${formatCurrency(buyer.previousBalance || 0)}`, pageWidth - 80, 52);
    doc.text(`Total Sales: ${formatCurrency(stats.totalSales || 0)}`, pageWidth - 80, 58);
    doc.text(`Total Payments: ${formatCurrency(stats.totalPayments || 0)}`, pageWidth - 80, 64);
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`CURRENT BALANCE: ${formatCurrency(stats.currentBalance || 0)}`, pageWidth - 80, 72);
    doc.setFont('helvetica', 'normal');

    // Table
    const tableData = ledgerEntries.map((entry, index) => {
      // Calculate running balance for this row
      // Note: ledgerEntries is sorted desc, so we need to calculate from bottom up or use a different approach
      // For simplicity in PDF, let's just show the entries
      return [
        entry.date ? new Date(entry.date).toLocaleDateString() : 'N/A',
        entry.description || '',
        entry.reference || '',
        (entry.debit || 0) > 0 ? `${formatCurrency(entry.debit || 0)}` : '-',
        (entry.credit || 0) > 0 ? `${formatCurrency(entry.credit || 0)}` : '-',
      ];
    });

    autoTable(doc, {
      startY: 80,
      head: [['Date', 'Description', 'Reference', 'Debit (Sales)', 'Credit (Payments)']],
      body: tableData,
      foot: [
        ['TOTAL', '', '', `${formatCurrency(stats.totalSales || 0)}`, `${formatCurrency(stats.totalPayments || 0)}`]
      ],
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8 },
      footStyles: { fillColor: [243, 244, 246], textColor: [31, 41, 55], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.5 },
      styles: { cellPadding: 1.5, overflow: 'linebreak' },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 35 },
        3: { cellWidth: 42, halign: 'left' },
        4: { cellWidth: 42, halign: 'left' },
      }
    });

    doc.save(`${buyer.name.replace(/\s+/g, '_')}_Ledger.pdf`);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <AnimatePresence>
        {errorMessage && (
          <Toast 
            message={errorMessage} 
            type="error" 
            onClose={() => setErrorMessage(null)} 
          />
        )}
        {successMessage && (
          <Toast 
            message={successMessage} 
            type="success" 
            onClose={() => setSuccessMessage(null)} 
          />
        )}
      </AnimatePresence>
      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <ArrowLeft size={20} className="text-slate-600" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">{buyer.name}</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Customer Ledger</p>
            </div>
          </div>
          <button 
            onClick={exportPDF}
            className="bg-slate-900 text-white p-2 rounded-xl shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2 text-xs font-bold"
          >
            <Download size={16} /> <span className="hidden sm:inline">Export PDF</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100">
            <p className="text-[8px] font-bold text-blue-600 uppercase mb-1">Total Sales</p>
            <p className="text-sm font-black text-blue-900">{formatCurrency(stats.totalSales || 0)}</p>
          </div>
          <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
            <p className="text-[8px] font-bold text-emerald-600 uppercase mb-1">Payments</p>
            <p className="text-sm font-black text-emerald-900">{formatCurrency(stats.totalPayments || 0)}</p>
          </div>
          <div className={cn(
            "p-3 rounded-2xl border shadow-sm",
            (stats.currentBalance || 0) >= 0 ? "bg-slate-900 border-slate-800 text-white" : "bg-rose-600 border-rose-500 text-white"
          )}>
            <p className="text-[8px] font-bold uppercase mb-1 opacity-70">Balance</p>
            <p className="text-sm font-black">{formatCurrency(stats.currentBalance || 0)}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        {/* Buyer Info Card */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Phone size={14} className="text-slate-400" />
            <span className="font-medium">{buyer.phone || 'N/A'}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <MapPin size={14} className="text-slate-400" />
            <span className="font-medium">{buyer.location || 'N/A'}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Calendar size={14} className="text-slate-400" />
            <span className="font-medium">Joined: {buyer.createdAt ? new Date(buyer.createdAt).toLocaleDateString() : 'N/A'}</span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2">
          {canPostTransactions && (
            <button
              onClick={() => setIsAddingSalesReturn(true)}
              className="flex-1 bg-rose-50 text-rose-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-xs shadow-sm hover:bg-rose-100"
            >
              <Plus size={16} /> Sales Return
            </button>
          )}
          {(isAccount || isAdmin) && (
            <button
              onClick={() => setIsAddingCustomerCharge(true)}
              className="flex-1 bg-amber-50 text-amber-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-xs shadow-sm hover:bg-amber-100"
            >
              <Plus size={16} /> Charge Customer
            </button>
          )}
        </div>

        {/* Ledger List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Transaction History</h2>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400">{ledgerEntries.length} Records</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Opening Balance Row */}
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center text-slate-500">
                  <Wallet size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Opening Balance</p>
                  <p className="text-[10px] text-slate-400">Initial balance at registration</p>
                </div>
              </div>
              <div className="text-right">
                <p className={cn(
                  "text-sm font-black",
                  (buyer.previousBalance || 0) >= 0 ? "text-blue-600" : "text-rose-600"
                )}>
                  {(buyer.previousBalance || 0) >= 0 ? '+' : ''}{formatCurrency(buyer.previousBalance || 0)}
                </p>
              </div>
            </div>

            {ledgerEntries.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="mx-auto text-slate-200 mb-2" size={48} />
                <p className="text-sm text-slate-400 font-medium">No transactions recorded yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {ledgerEntries.map((entry) => (
                  <div key={entry.id} className="p-4 hover:bg-slate-50 transition-colors group">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center",
                          entry.type === 'SALE' ? "bg-blue-50 text-blue-600" :
                          (entry.type as string) === 'SALES_RETURN' ? "bg-rose-50 text-rose-600" :
                          entry.debit > 0 ? "bg-amber-50 text-amber-600" :
                          "bg-emerald-50 text-emerald-600"
                        )}>
                          {entry.type === 'SALE' || entry.debit > 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">{entry.description}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">
                              {entry.reference}
                            </span>
                            <span className="text-[10px] text-slate-400">{entry.date ? new Date(entry.date).toLocaleDateString() : 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {(entry.debit || 0) > 0 && (
                          <p className="text-sm font-black text-rose-600">+{formatCurrency(entry.debit)}</p>
                        )}
                        {(entry.credit || 0) > 0 && (
                          <p className="text-sm font-black text-emerald-600">-{formatCurrency(entry.credit)}</p>
                        )}
                        <p className="text-[9px] text-slate-400 uppercase font-bold">
                          {(entry.debit || 0) > 0 ? 'Debit (Owed to Us)' : 'Credit'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {isAddingSalesReturn && (
          <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ y: "100%" }} 
              animate={{ y: 0 }} 
              exit={{ y: "100%" }}
              className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl my-auto"
            >
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-rose-600">
                <Plus className="rotate-45" size={24} /> New Sales Return
              </h2>
              <form onSubmit={handleAddSalesReturn} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Date</label>
                  <input 
                    name="date" 
                    type="date" 
                    required 
                    defaultValue={new Date().toISOString().substring(0, 10)} 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Warehouse</label>
                  <select name="warehouseId" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm">
                    <option value="">Select Warehouse</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Commodity</label>
                  <select name="commodity" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm">
                    <option value="COCOA">Cocoa</option>
                    <option value="CASHEW">Cashew</option>
                    <option value="PK">Palm Kernel (PK)</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bags</label>
                    <DigitFormattedInput name="bags" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium" suffix="bags" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Gross Weight (kg)</label>
                    <DigitFormattedInput name="grossWeight" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium" suffix="kg" placeholder="0" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Net Weight (kg)</label>
                    <DigitFormattedInput 
                      name="netWeight" 
                      required 
                      value={returnNetWeight}
                      onChange={(e: any) => setReturnNetWeight(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium" 
                      suffix="kg" 
                      placeholder="0" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Price Per Kg (₦)</label>
                    <DigitFormattedInput 
                      name="pricePerKg" 
                      required 
                      value={returnPricePerKg}
                      onChange={(e: any) => setReturnPricePerKg(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium" 
                      prefix="₦" 
                      placeholder="0" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Total Return Value (₦)</label>
                  <DigitFormattedInput 
                    name="totalValue" 
                    required 
                    value={String(roundTo((Number(returnNetWeight.replace(/,/g, '')) || 0) * (Number(returnPricePerKg.replace(/,/g, '')) || 0), 2))}
                    className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl outline-none text-sm font-black text-rose-700" 
                    prefix="₦" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Reference ID (Optional)</label>
                  <input name="referenceId" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium" placeholder="e.g. RET-001" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Notes / Reason</label>
                  <input name="notes" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium" placeholder="Reason for return..." />
                </div>
                <div className="flex gap-3 mt-6">
                  <button type="button" onClick={() => setIsAddingSalesReturn(false)} className="flex-1 py-4 text-slate-500 font-bold text-sm">Cancel</button>
                  <button 
                    type="submit" 
                    disabled={submitting}
                    className="flex-2 bg-rose-600 text-white py-4 rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                  >
                    {submitting ? 'Recording...' : 'Record Return'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isAddingCustomerCharge && (
          <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ y: "100%" }} 
              animate={{ y: 0 }} 
              exit={{ y: "100%" }}
              className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl my-auto"
            >
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-amber-600">
                <Plus className="rotate-45" size={24} /> New Customer Charge
              </h2>
              <form onSubmit={handleAddCustomerCharge} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Date</label>
                  <input 
                    name="date" 
                    type="date" 
                    required 
                    defaultValue={new Date().toISOString().substring(0, 10)} 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Warehouse</label>
                  <select name="warehouseId" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm">
                    <option value="">Select Warehouse</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Amount (₦)</label>
                  <DigitFormattedInput name="amount" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium" prefix="₦" placeholder="0" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Payment Method</label>
                  <select name="paymentMethod" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm">
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Description / Notes</label>
                  <input name="description" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium" placeholder="Describe the charge..." />
                </div>
                <div className="flex gap-3 mt-6">
                  <button type="button" onClick={() => setIsAddingCustomerCharge(false)} className="flex-1 py-4 text-slate-500 font-bold text-sm">Cancel</button>
                  <button 
                    type="submit" 
                    disabled={submitting}
                    className="flex-2 bg-amber-600 text-white py-4 rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                  >
                    {submitting ? 'Recording...' : 'Record Charge'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
