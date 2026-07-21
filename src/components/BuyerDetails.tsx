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
  Edit2,
  Trash2
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
  const [currentBuyer, setCurrentBuyer] = useState<Buyer>(buyer);

  // Sync with prop if it changes
  useEffect(() => {
    setCurrentBuyer(buyer);
  }, [buyer]);

  // Subscribe to real-time updates for this specific buyer document
  useEffect(() => {
    if (!profile?.companyId || !buyer.id) return;
    const unsubscribeBuyer = onSnapshot(doc(db, 'buyers', buyer.id), (snapshot) => {
      if (snapshot.exists()) {
        setCurrentBuyer({ ...snapshot.data(), id: snapshot.id } as Buyer);
      }
    });
    return () => unsubscribeBuyer();
  }, [buyer.id, profile?.companyId]);

  const [isAddingSalesReturn, setIsAddingSalesReturn] = useState(false);
  const [isAddingCustomerCharge, setIsAddingCustomerCharge] = useState(false);
  const [isAddingDirectPayment, setIsAddingDirectPayment] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [returnNetWeight, setReturnNetWeight] = useState<string>('');
  const [returnPricePerKg, setReturnPricePerKg] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<{
    id: string;
    entryType: 'TRANSACTION' | 'JOURNAL';
  } | null>(null);
  const [editingEntry, setEditingEntry] = useState<{
    id: string;
    entryType: 'TRANSACTION' | 'JOURNAL';
    originalDoc: any;
  } | null>(null);

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
    if (!canPostTransactions || submitting || !profile?.companyId) return;

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

  const handleAddDirectPayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canPostTransactions || submitting || !profile?.companyId) return;

    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const id = crypto.randomUUID();
    const selectedDate = formData.get('date') as string;
    const paymentDateIso = selectedDate 
      ? new Date(selectedDate + 'T12:00:00').toISOString() 
      : new Date().toISOString();

    const desc = formData.get('description') as string || 'Direct Payment';
    const method = formData.get('paymentMethod') as string;
    const ref = formData.get('reference') as string || '';

    const newPayment: JournalEntry = {
      id,
      companyId: profile.companyId,
      warehouseId: formData.get('warehouseId') as string,
      date: paymentDateIso,
      postingDate: new Date().toISOString(),
      buyerId: buyer.id,
      amount: Number(formData.get('amount')),
      type: 'INFLOW',
      category: 'PART_PAYMENT',
      description: desc + ` (${method})`,
      reference: ref,
      paymentMethod: method as any,
      excludeFromJournal: true
    };

    try {
      const writePromise = setDoc(doc(db, 'journal', id), newPayment);
      
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
        module: 'Journal',
        recordId: id,
        details: `Recorded direct credit payment of ₦${newPayment.amount} to buyer account of ${buyer.name}`,
        newData: newPayment
      }).catch(err => console.error('Failed to log audit:', err));

      setIsAddingDirectPayment(false);
      setSuccessMessage('Payment successfully credited!');
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, OperationType.CREATE, `journal/${id}`));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async (reason: string) => {
    if (!deleteConfirmId || !profile) return;
    setSubmitting(true);
    const { id, entryType } = deleteConfirmId;
    const updateData = {
      isDeleted: true,
      deletionReason: reason || 'Deleted by user',
      deletedBy: profile?.email || profile?.uid || 'Unknown',
      deletedAt: new Date().toISOString()
    };

    try {
      let collectionName = '';
      if (entryType === 'TRANSACTION') {
        collectionName = 'transactions';
      } else if (entryType === 'JOURNAL') {
        collectionName = 'journal';
      }

      await setDoc(doc(db, collectionName, id), updateData, { merge: true });

      // Record Audit Log
      await recordAuditLog({
        companyId: profile.companyId,
        userId: profile.uid,
        userEmail: profile.email,
        action: AuditAction.DELETE,
        module: entryType === 'TRANSACTION' ? 'Transactions' : 'Journal',
        recordId: id,
        details: `Deleted (Soft) ${entryType.toLowerCase()} entry. Reason: ${reason}`,
        newData: updateData
      }).catch(err => console.error('Failed to log audit:', err));

      setSuccessMessage('Entry successfully deleted!');
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, OperationType.UPDATE, `${entryType.toLowerCase()}/${id}`));
    } finally {
      setSubmitting(false);
      setDeleteConfirmId(null);
    }
  };

  const handleAdjustSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isAdmin || !editingEntry || submitting || !profile?.companyId) return;

    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const updatedDate = formData.get('date') as string;
    const dateIso = updatedDate ? new Date(updatedDate + 'T12:00:00').toISOString() : editingEntry.originalDoc.date;

    try {
      if (editingEntry.entryType === 'TRANSACTION') {
        const docRef = doc(db, 'transactions', editingEntry.id);
        const grossVal = Number(formData.get('grossWeight') || 0);
        const bagsVal = Number(formData.get('bags') || 0);
        const priceVal = Number(formData.get('pricePerKg') || 0);
        
        // Compute moisture benchmark for commodity
        const benchmarkVal = editingEntry.originalDoc.commodity === 'CASHEW' ? 10 : 8;
        const moistureAct = Number(formData.get('moistureActual') || benchmarkVal);
        const tare = Number(formData.get('tareWeight') || 0);
        const mold = Number(formData.get('moldWeight') || 0);
        const other = Number(formData.get('otherDeduction') || 0);
        
        // If manual calculation, use the input netWeight value; if direct, perform calculation
        let calculatedNet = editingEntry.originalDoc.calculationMethod === 'MANUAL' 
          ? (Number(formData.get('netWeight')) || Number(editingEntry.originalDoc.netWeight) || 0)
          : 0;

        if (editingEntry.originalDoc.calculationMethod !== 'MANUAL') {
          const moistureLoss = moistureAct > benchmarkVal 
            ? roundTo(((moistureAct - benchmarkVal) * grossVal) / 100, 2) 
            : 0;
          calculatedNet = roundTo(grossVal - moistureLoss - tare - mold - other, 2);
        }
        
        const calculatedTotal = roundTo(calculatedNet * priceVal, 2);

        const updatedTx: any = {
          ...editingEntry.originalDoc,
          date: dateIso,
          grossWeight: grossVal,
          netWeight: calculatedNet,
          bags: bagsVal,
          noOfBags: bagsVal,
          pricePerKg: priceVal,
          totalValue: calculatedTotal,
          notes: formData.get('notes') as string,
          deductions: {
            moistureActual: moistureAct,
            moistureBenchmark: benchmarkVal,
            tareWeight: tare,
            moldWeight: mold,
            otherDeduction: other
          }
        };

        await setDoc(docRef, updatedTx);

        // Record Audit Log
        await recordAuditLog({
          companyId: profile.companyId,
          userId: profile.uid,
          userEmail: profile.email,
          action: AuditAction.UPDATE,
          module: 'Transactions',
          recordId: editingEntry.id,
          details: `Adjusted sales/return transaction ${editingEntry.originalDoc.referenceId || editingEntry.id}: set gross weight to ${grossVal}kg, net to ${calculatedNet}kg, price to ₦${priceVal}/kg, total value to ₦${calculatedTotal}`,
          previousData: editingEntry.originalDoc,
          newData: updatedTx
        }).catch(err => console.error('Failed to log audit:', err));

      } else if (editingEntry.entryType === 'JOURNAL') {
        const docRef = doc(db, 'journal', editingEntry.id);
        const amountVal = Number(formData.get('amount') || 0);
        const categoryVal = formData.get('category') as string;
        const descVal = formData.get('description') as string;

        const updatedJournal = {
          ...editingEntry.originalDoc,
          date: dateIso,
          amount: amountVal,
          category: categoryVal,
          description: descVal
        };

        await setDoc(docRef, updatedJournal);

        // Record Audit Log
        await recordAuditLog({
          companyId: profile.companyId,
          userId: profile.uid,
          userEmail: profile.email,
          action: AuditAction.UPDATE,
          module: 'Journal',
          recordId: editingEntry.id,
          details: `Adjusted customer journal ${editingEntry.originalDoc.type?.toLowerCase() || 'entry'} of ₦${amountVal} linked to customer: ${buyer.name}`,
          previousData: editingEntry.originalDoc,
          newData: updatedJournal
        }).catch(err => console.error('Failed to log audit:', err));
      }

      setEditingEntry(null);
      setSuccessMessage('Entry successfully updated!');
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, OperationType.UPDATE, `${editingEntry.entryType.toLowerCase()}/${editingEntry.id}`));
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
        reference: s.referenceId,
        entryType: 'TRANSACTION' as const,
        originalDoc: s
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
        reference: p.reference || p.category,
        entryType: 'JOURNAL' as const,
        originalDoc: p
      }))
    ];

    return entries.sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      if (dateB !== dateA) return dateB - dateA;
      const postA = new Date(a.originalDoc?.postingDate || a.date || 0).getTime();
      const postB = new Date(b.originalDoc?.postingDate || b.date || 0).getTime();
      return postB - postA;
    });
  }, [sales, payments]);

  const stats = useMemo(() => {
    const totalSales = sales.filter(s => s.type === 'SALE').reduce((sum, s) => sum + roundTo(s.totalValue || 0, 2), 0);
    const totalReturns = sales.filter(s => (s.type as string) === 'SALES_RETURN').reduce((sum, s) => sum + roundTo(s.totalValue || 0, 2), 0);
    const totalPayments = payments.filter(p => p.type === 'INFLOW').reduce((sum, p) => sum + roundTo(p.amount || 0, 2), 0);
    const totalCharges = payments.filter(p => p.type === 'OUTFLOW').reduce((sum, p) => sum + roundTo(p.amount || 0, 2), 0);
    const currentBalance = roundTo((Number(currentBuyer.previousBalance) || 0) + totalSales - totalReturns + totalCharges - totalPayments, 2);

    return { totalSales, totalPayments, currentBalance, totalReturns, totalCharges };
  }, [sales, payments, currentBuyer.previousBalance]);

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
    doc.text((currentBuyer.name || 'UNKNOWN').toUpperCase(), 20, 45);
    
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Phone: ${currentBuyer.phone || 'N/A'}`, 20, 52);
    doc.text(`Location: ${currentBuyer.location || 'N/A'}`, 20, 58);

    // Summary Stats in PDF
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('SUMMARY', pageWidth - 80, 45);
    doc.setFontSize(9);
    doc.text(`Opening Balance: ${formatCurrency(Number(currentBuyer.previousBalance) || 0)}`, pageWidth - 80, 52);
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

    doc.save(`${currentBuyer.name.replace(/\s+/g, '_')}_Ledger.pdf`);
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
              <h1 className="text-lg font-bold text-slate-900 leading-tight">{currentBuyer.name}</h1>
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
            <span className="font-medium">{currentBuyer.phone || 'N/A'}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <MapPin size={14} className="text-slate-400" />
            <span className="font-medium">{currentBuyer.location || 'N/A'}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Calendar size={14} className="text-slate-400" />
            <span className="font-medium">Joined: {currentBuyer.createdAt ? new Date(currentBuyer.createdAt).toLocaleDateString() : 'N/A'}</span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 flex-wrap">
          {canPostTransactions && (
            <>
              <button
                onClick={() => setIsAddingSalesReturn(true)}
                className="flex-1 min-w-[120px] bg-rose-50 text-rose-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-xs shadow-sm hover:bg-rose-100"
              >
                <Plus size={16} /> Sales Return
              </button>
              <button
                onClick={() => setIsAddingDirectPayment(true)}
                className="flex-1 min-w-[120px] bg-emerald-50 text-emerald-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-xs shadow-sm hover:bg-emerald-100"
              >
                <Plus size={16} /> Direct Credit
              </button>
              <button
                onClick={() => setIsAddingCustomerCharge(true)}
                className="flex-1 min-w-[120px] bg-amber-50 text-amber-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-xs shadow-sm hover:bg-amber-100"
              >
                <Plus size={16} /> Charge Customer
              </button>
            </>
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
                  (Number(currentBuyer.previousBalance) || 0) >= 0 ? "text-blue-600" : "text-rose-600"
                )}>
                  {(Number(currentBuyer.previousBalance) || 0) >= 0 ? '+' : ''}{formatCurrency(Number(currentBuyer.previousBalance) || 0)}
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
                  <div key={`${entry.entryType}-${entry.id}`} className="p-4 hover:bg-slate-50 transition-colors group">
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
                        {isAdmin && (
                          <button
                            onClick={() => setDeleteConfirmId({
                              id: entry.id,
                              entryType: entry.entryType
                            })}
                            className="mt-2 text-[10px] text-rose-600 font-black hover:text-rose-700 hover:underline flex items-center gap-1 justify-end ml-auto"
                            title="Delete Entry"
                          >
                            <Trash2 size={10} /> Delete
                          </button>
                        )}
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

        {isAddingDirectPayment && (
          <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ y: "100%" }} 
              animate={{ y: 0 }} 
              exit={{ y: "100%" }}
              className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl my-auto"
            >
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-emerald-600">
                <Plus className="rotate-45" size={24} /> Direct Credit Payment
              </h2>
              <form onSubmit={handleAddDirectPayment} className="space-y-4">
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
                    <option value="CHEQUE">Cheque</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Reference / Receipt #</label>
                  <input name="reference" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium" placeholder="Optional txn reference..." />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Description / Notes</label>
                  <input name="description" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium" placeholder="Direct Payment to Buyer Account" />
                </div>
                <div className="flex gap-3 mt-6">
                  <button type="button" onClick={() => setIsAddingDirectPayment(false)} className="flex-1 py-4 text-slate-500 font-bold text-sm">Cancel</button>
                  <button 
                    type="submit" 
                    disabled={submitting}
                    className="flex-2 bg-emerald-600 text-white py-4 rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                  >
                    {submitting ? 'Crediting...' : 'Credit Account'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {deleteConfirmId && (
          <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ y: "100%" }} 
              animate={{ y: 0 }} 
              exit={{ y: "100%" }}
              className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl my-auto"
            >
              <h2 className="text-xl font-bold mb-4 text-rose-600 flex items-center gap-2">
                <Trash2 size={24} /> Delete Entry
              </h2>
              <p className="text-sm text-slate-500 mb-6">
                Are you sure you want to delete this ledger entry? This action cannot be undone, and will require a reason for audit tracking.
              </p>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const reason = new FormData(e.currentTarget).get('reason') as string;
                if (!reason) return;
                await confirmDelete(reason);
              }} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Reason for deletion</label>
                  <input 
                    name="reason" 
                    required 
                    placeholder="e.g. Typo in amount, incorrect customer" 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium" 
                  />
                </div>
                <div className="flex gap-3 mt-6">
                  <button type="button" onClick={() => setDeleteConfirmId(null)} className="flex-1 py-4 text-slate-500 font-bold text-sm">Cancel</button>
                  <button 
                    type="submit" 
                    disabled={submitting}
                    className="flex-2 bg-rose-600 text-white py-4 rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                  >
                    {submitting ? 'Deleting...' : 'Confirm Delete'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {editingEntry && (
          <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ y: "100%" }} 
              animate={{ y: 0 }} 
              exit={{ y: "100%" }}
              className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl my-auto"
            >
              <h2 className="text-xl font-bold mb-6">Adjust Entry ({editingEntry.entryType})</h2>
              <form onSubmit={handleAdjustSave} className="space-y-4">
                {/* Date is common to all */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Date</label>
                  <input 
                    name="date" 
                    type="date" 
                    required 
                    defaultValue={editingEntry.originalDoc.date?.substring(0, 10)} 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium" 
                  />
                </div>

                {editingEntry.entryType === 'TRANSACTION' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Gross Weight (kg)</label>
                        <DigitFormattedInput name="grossWeight" required defaultValue={editingEntry.originalDoc.grossWeight} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium" suffix="kg" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bags</label>
                        <DigitFormattedInput name="bags" required defaultValue={editingEntry.originalDoc.noOfBags || editingEntry.originalDoc.bags || 0} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium" suffix="bags" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Price Per Kg (₦)</label>
                        <DigitFormattedInput name="pricePerKg" required defaultValue={editingEntry.originalDoc.pricePerKg} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium" prefix="₦" />
                      </div>
                      {editingEntry.originalDoc.calculationMethod === 'MANUAL' && (
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Net Weight (kg)</label>
                          <DigitFormattedInput name="netWeight" required defaultValue={editingEntry.originalDoc.netWeight} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium" suffix="kg" />
                        </div>
                      )}
                    </div>

                    {editingEntry.originalDoc.calculationMethod !== 'MANUAL' && (
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-3">
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Deduction Inputs (Calculated Net Weight)</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[8px] font-bold text-slate-400 uppercase">Moisture Actual (%)</label>
                            <input name="moistureActual" type="number" step="0.1" defaultValue={editingEntry.originalDoc.deductions?.moistureActual || 8} className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs" />
                          </div>
                          <div>
                            <label className="block text-[8px] font-bold text-slate-400 uppercase">Tare Weight (kg)</label>
                            <input name="tareWeight" type="number" step="0.1" defaultValue={editingEntry.originalDoc.deductions?.tareWeight || 0} className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs" />
                          </div>
                          <div>
                            <label className="block text-[8px] font-bold text-slate-400 uppercase">Mold Weight (kg)</label>
                            <input name="moldWeight" type="number" step="0.1" defaultValue={editingEntry.originalDoc.deductions?.moldWeight || 0} className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs" />
                          </div>
                          <div>
                            <label className="block text-[8px] font-bold text-slate-400 uppercase">Other Ded. (kg)</label>
                            <input name="otherDeduction" type="number" step="0.1" defaultValue={editingEntry.originalDoc.deductions?.otherDeduction || 0} className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs" />
                          </div>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Notes / Remarks</label>
                      <input name="notes" defaultValue={editingEntry.originalDoc.notes || ''} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium text-sm" placeholder="Reason for adjusting..." />
                    </div>
                  </>
                )}

                {editingEntry.entryType === 'JOURNAL' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Amount (₦)</label>
                        <DigitFormattedInput name="amount" required defaultValue={editingEntry.originalDoc.amount} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium" prefix="₦" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Category</label>
                        <input name="category" required defaultValue={editingEntry.originalDoc.category} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Description</label>
                      <input name="description" required defaultValue={editingEntry.originalDoc.description} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium" />
                    </div>
                  </>
                )}

                <div className="flex gap-3 mt-6">
                  <button type="button" onClick={() => setEditingEntry(null)} className="flex-1 py-4 text-slate-500 font-bold">Cancel</button>
                  <button 
                    type="submit" 
                    disabled={submitting}
                    className="flex-2 bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm font-medium"
                  >
                    {submitting ? 'Saving Changes...' : 'Save Adjustments'}
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
