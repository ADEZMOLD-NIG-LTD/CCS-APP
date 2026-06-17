/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  FileText, 
  Plus, 
  Download, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Package, 
  History,
  Calendar,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Edit2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Supplier, Transaction, Payment, BagTransaction, JournalEntry, Warehouse, PackagingType, CommodityType } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, query, where, orderBy } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, reportFirestoreError, OperationType } from '../lib/firestore';
import { recordAuditLog, AuditAction } from '../lib/audit';
import Toast from './Toast';
import { cn, roundTo, formatNumber, formatCurrency } from '../lib/utils';
import { DigitFormattedInput } from './DigitFormattedInput';

interface Props {
  supplier: Supplier;
  onBack: () => void;
}

export default function SupplierDetails({ supplier, onBack }: Props) {
  const { profile, company, isStaff, isAccount, isAdmin, isOnline, canPostTransactions, errorMessage, setErrorMessage } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [bagTransactions, setBagTransactions] = useState<BagTransaction[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [activeTab, setActiveTab] = useState<'ledger' | 'bags' | 'payments'>('ledger');
  const [currentSupplier, setCurrentSupplier] = useState<Supplier>(supplier);

  // Sync with prop if it changes
  useEffect(() => {
    setCurrentSupplier(supplier);
  }, [supplier]);

  // Real-time subscription to the supplier document
  useEffect(() => {
    if (!profile?.companyId || !supplier.id) return;
    const unsubscribeSupplier = onSnapshot(doc(db, 'suppliers', supplier.id), (snapshot) => {
      if (snapshot.exists()) {
        setCurrentSupplier({ ...snapshot.data(), id: snapshot.id } as Supplier);
      }
    });
    return () => unsubscribeSupplier();
  }, [supplier.id, profile?.companyId]);

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    return `${year}-01-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const [isAddingPurchaseReturn, setIsAddingPurchaseReturn] = useState(false);
  const [isAddingSupplierCharge, setIsAddingSupplierCharge] = useState(false);
  const [editingEntry, setEditingEntry] = useState<{
    id: string;
    entryType: 'TRANSACTION' | 'PAYMENT' | 'JOURNAL';
    originalDoc: any;
  } | null>(null);
  const [isAddingBagTx, setIsAddingBagTx] = useState(false);
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

  // Load Data from Firestore
  useEffect(() => {
    if (!profile?.companyId) return;

    const qTx = query(
      collection(db, 'transactions'), 
      where('companyId', '==', profile.companyId),
      where('supplierId', '==', supplier.id)
    );
    const unsubscribeTx = onSnapshot(qTx, (snapshot) => {
      const data = snapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id } as Transaction))
        .filter(t => !t.isDeleted);
      const sorted = data.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      setTransactions(sorted);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'transactions')));

    const qPayments = query(
      collection(db, 'payments'), 
      where('companyId', '==', profile.companyId),
      where('supplierId', '==', supplier.id)
    );
    const unsubscribePayments = onSnapshot(qPayments, (snapshot) => {
      const data = snapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id } as Payment))
        .filter(p => !p.isDeleted);
      const sorted = data.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      setPayments(sorted);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'payments')));

    const qBagTx = query(
      collection(db, 'bag_transactions'), 
      where('companyId', '==', profile.companyId),
      where('supplierId', '==', supplier.id)
    );
    const unsubscribeBagTx = onSnapshot(qBagTx, (snapshot) => {
      const data = snapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id } as BagTransaction))
        .filter(b => !b.isDeleted);
      const sorted = data.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      setBagTransactions(sorted);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'bag_transactions')));

    const qJournal = query(
      collection(db, 'journal'), 
      where('companyId', '==', profile.companyId),
      where('supplierId', '==', supplier.id)
    );
    const unsubscribeJournal = onSnapshot(qJournal, (snapshot) => {
      const data = snapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id } as JournalEntry))
        .filter(j => !j.isDeleted);
      const sorted = data.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      setJournal(sorted);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'journal')));

    const qWarehouses = query(
      collection(db, 'warehouses'), 
      where('companyId', '==', profile.companyId)
    );
    const unsubscribeWarehouses = onSnapshot(qWarehouses, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Warehouse));
      const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
      setWarehouses(sorted);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'warehouses')));

    return () => {
      unsubscribeTx();
      unsubscribePayments();
      unsubscribeBagTx();
      unsubscribeJournal();
      unsubscribeWarehouses();
    };
  }, [supplier.id, profile?.companyId]);

  // Calculations
  const ledgerEntries = useMemo(() => {
    const allEntries = [
      ...transactions.map(t => ({
        id: t.id,
        entryType: 'TRANSACTION' as const,
        originalDoc: t,
        date: t.date,
        description: t.type === 'SALE' 
          ? (t.isDirectDelivery ? `Direct Delivery Sale: ${t.commodity}` : `Sale: ${t.commodity} (${formatNumber(t.netWeight || 0)}kg)`)
          : (t.type as string) === 'PURCHASE_RETURN'
            ? `Purchase Return: ${t.commodity} (${formatNumber(t.netWeight || 0)}kg)`
            : `Purchase: ${t.commodity} (${formatNumber(t.netWeight || 0)}kg)`,
        credit: t.type === 'PURCHASE' ? roundTo(t.totalValue || 0, 2) : 0,
        debit: (t.type === 'SALE' || (t.type as string) === 'PURCHASE_RETURN') ? roundTo(t.totalValue || 0, 2) : 0,
        ref: t.referenceId,
        grossWeight: t.grossWeight || 0,
        netWeight: t.netWeight || 0,
        deductionWeight: (t.grossWeight || 0) - (t.netWeight || 0),
        deductions: t.deductions,
        pricePerKg: t.pricePerKg || 0,
        bags: t.noOfBags || t.bags || 0
      })),
      ...payments.map(p => ({
        id: p.id,
        entryType: 'PAYMENT' as const,
        originalDoc: p,
        date: p.date,
        description: `Payment: ${p.method} - ${p.description}`,
        credit: 0,
        debit: roundTo(p.amount || 0, 2),
        ref: p.reference,
        grossWeight: 0,
        netWeight: 0,
        deductionWeight: 0,
        deductions: undefined,
        pricePerKg: 0,
        bags: 0
      })),
      ...journal.map(e => ({
        id: e.id,
        entryType: 'JOURNAL' as const,
        originalDoc: e,
        date: e.date,
        description: e.type === 'INFLOW' 
          ? `Credit/Reversal: ${e.category} - ${e.description}`
          : `Charge: ${e.category} - ${e.description}`,
        credit: e.type === 'INFLOW' ? roundTo(e.amount || 0, 2) : 0,
        debit: e.type === 'OUTFLOW' ? roundTo(e.amount || 0, 2) : 0,
        ref: 'JOURNAL',
        grossWeight: 0,
        netWeight: 0,
        deductionWeight: 0,
        deductions: undefined,
        pricePerKg: 0,
        bags: 0
      }))
    ].sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());

    // Calculate Balance Brought Forward (BBF)
    let bbf = Number(currentSupplier.previousBalance) || 0;
    const filtered = [];
    
    for (const entry of allEntries) {
      const entryDate = (entry.date || '').split('T')[0];
      if (entryDate < startDate) {
        bbf = roundTo(bbf + ((entry.credit || 0) - (entry.debit || 0)), 2);
      } else if (entryDate <= endDate) {
        filtered.push(entry);
      }
    }

    const sortedEntries = filtered.sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());
    let runningBalance = bbf;
    const entriesWithBalance = sortedEntries.map(entry => {
      runningBalance = roundTo(runningBalance + ((entry.credit || 0) - (entry.debit || 0)), 2);
      return { ...entry, runningBalance };
    });

    return { 
      entries: entriesWithBalance.reverse(), 
      bbf 
    };
  }, [transactions, payments, journal, currentSupplier.previousBalance, startDate, endDate, supplier.id]);

  const totalPurchases = useMemo(() => transactions.filter(t => t.type === 'PURCHASE').reduce((sum, t) => sum + roundTo(Number(t.totalValue) || 0, 2), 0), [transactions]);
  const totalReturns = useMemo(() => transactions.filter(t => (t.type as string) === 'PURCHASE_RETURN').reduce((sum, t) => sum + roundTo(Number(t.totalValue) || 0, 2), 0), [transactions]);
  const totalSales = useMemo(() => transactions.filter(t => t.type === 'SALE').reduce((sum, t) => sum + roundTo(Number(t.totalValue) || 0, 2), 0), [transactions]);
  const totalPayments = useMemo(() => payments.reduce((sum, p) => sum + roundTo(Number(p.amount) || 0, 2), 0), [payments]);
  const totalCharges = useMemo(() => journal.reduce((sum, e) => sum + roundTo(e.type === 'OUTFLOW' ? Number(e.amount) || 0 : -Number(e.amount) || 0, 2), 0), [journal]);
  const currentBalance = roundTo((Number(currentSupplier.previousBalance) || 0) + totalPurchases - totalReturns - totalSales - totalPayments - totalCharges, 2);

  const bagBalance = useMemo(() => {
    return bagTransactions.reduce((sum, b) => {
      return b.type === 'ISSUE' ? sum + (b.quantity || 0) : sum - (b.quantity || 0);
    }, 0);
  }, [bagTransactions]);

  // Handlers
  const handleAddPayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!(isAccount || isAdmin) || submitting || !profile?.companyId) return;

    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const id = crypto.randomUUID();
    const isAdvance = formData.get('isAdvance') === 'on';
    const description = formData.get('description') as string;
    const selectedDate = formData.get('transactionDate') as string;
    const transactionDateIso = selectedDate 
      ? new Date(selectedDate + 'T12:00:00').toISOString() 
      : new Date().toISOString();
    
    const newPayment: any = {
      id,
      companyId: profile.companyId,
      warehouseId: formData.get('warehouseId') as string,
      date: transactionDateIso,
      postingDate: new Date().toISOString(),
      supplierId: supplier.id,
      amount: Number(formData.get('amount')),
      method: formData.get('method') as any,
      reference: formData.get('reference') as string,
      description: isAdvance ? `[ADVANCE] ${description}` : description,
    };

    // Clean up undefined values
    Object.keys(newPayment).forEach(key => newPayment[key] === undefined && delete newPayment[key]);

    try {
      const writePromise = setDoc(doc(db, 'payments', id), newPayment);
      
      if (!isOnline) {
        console.log('Working offline, proceeding optimistically');
      } else {
        await writePromise;
      }
      
      // Record Audit Log (non-blocking for UI)
      recordAuditLog({
        companyId: profile.companyId,
        userId: profile.uid,
        userEmail: profile.email,
        action: AuditAction.CREATE,
        module: 'Payments',
        recordId: id,
        details: `Recorded payment of ${formatCurrency(newPayment.amount)} to ${supplier.name}`,
        newData: newPayment
      }).catch(err => console.error('Audit log failed:', err));

      setIsAddingPayment(false);
      setSuccessMessage('Payment successfully recorded!');
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, OperationType.CREATE, `payments/${id}`));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddBagTx = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isStaff || submitting || !profile?.companyId) return;

    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const id = crypto.randomUUID();
    const newBagTx: any = {
      id,
      companyId: profile.companyId,
      date: new Date().toISOString(),
      supplierId: supplier.id,
      type: formData.get('type') as any,
      packagingType: formData.get('packagingType') as PackagingType,
      warehouseId: formData.get('warehouseId') as string,
      quantity: Number(formData.get('quantity')),
      reference: (formData.get('reference') as string) || `BAG-${Date.now().toString().slice(-6)}`,
    };

    // Clean up undefined values
    Object.keys(newBagTx).forEach(key => newBagTx[key] === undefined && delete newBagTx[key]);

    try {
      const writePromise = setDoc(doc(db, 'bag_transactions', id), newBagTx);
      
      if (!isOnline) {
        console.log('Working offline, proceeding optimistically');
      } else {
        await writePromise;
      }
      
      // Record Audit Log (non-blocking for UI)
      recordAuditLog({
        companyId: profile.companyId,
        userId: profile.uid,
        userEmail: profile.email,
        action: AuditAction.CREATE,
        module: 'Bag Transactions',
        recordId: id,
        details: `${newBagTx.type === 'ISSUE' ? 'Issued' : 'Returned'} ${newBagTx.quantity} bags to/from ${supplier.name}`,
        newData: newBagTx
      }).catch(err => console.error('Audit log failed:', err));

      setIsAddingBagTx(false);
      setSuccessMessage('Bag transaction successfully recorded!');
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, OperationType.CREATE, `bag_transactions/${id}`));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddPurchaseReturn = async (e: React.FormEvent<HTMLFormElement>) => {
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
      type: 'PURCHASE_RETURN',
      commodity: formData.get('commodity') as CommodityType,
      supplierId: supplier.id,
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
        module: 'Purchase Returns',
        recordId: id,
        details: `Recorded purchase return of ${newTx.commodity} (${formatNumber(newTx.netWeight)}kg) valued at ${formatCurrency(newTx.totalValue)} for ${supplier.name}`,
        newData: newTx
      }).catch(err => console.error('Audit log failed:', err));

      setIsAddingPurchaseReturn(false);
      setSuccessMessage('Purchase return successfully recorded!');
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, OperationType.CREATE, `transactions/${id}`));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddSupplierCharge = async (e: React.FormEvent<HTMLFormElement>) => {
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
      category: 'SUPPLIER_CHARGE',
      amount: Number(formData.get('amount')),
      description: formData.get('description') as string,
      supplierId: supplier.id,
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
        module: 'Supplier Charges',
        recordId: id,
        details: `Recorded supplier charge: ${newEntry.description} of amount ${formatCurrency(newEntry.amount)} for ${supplier.name}`,
        newData: newEntry
      }).catch(err => console.error('Audit log failed:', err));

      setIsAddingSupplierCharge(false);
      setSuccessMessage('Supplier charge successfully recorded!');
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, OperationType.CREATE, `journal/${id}`));
    } finally {
      setSubmitting(false);
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF('landscape');
    
    // Company Header
    doc.setFontSize(22);
    doc.setTextColor(16, 185, 129); // Emerald-600
    doc.text(company?.name?.toUpperCase() || 'CCS COMMODITY CONTROL SYSTEM', 148, 20, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59); // Slate-800
    doc.text('SUPPLIER LEDGER STATEMENT', 148, 30, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Period: ${startDate ? new Date(startDate).toLocaleDateString() : 'N/A'} to ${endDate ? new Date(endDate).toLocaleDateString() : 'N/A'}`, 148, 38, { align: 'center' });
    
    doc.setDrawColor(200);
    doc.line(15, 45, 282, 45);

    // Supplier Info
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`Supplier: ${currentSupplier.name || 'UNKNOWN'}`, 15, 55);
    doc.setFontSize(10);
    doc.text(`Phone: ${currentSupplier.phone || 'N/A'}`, 15, 62);
    doc.text(`Location: ${currentSupplier.location || 'N/A'}`, 15, 69);

    // Summary Box - shifted right to align with the margin at x=282
    doc.setFillColor(248, 250, 252); // Slate-50
    doc.rect(222, 50, 60, 25, 'F');
    doc.setFontSize(8);
    doc.text('CURRENT BALANCE', 227, 58);
    doc.setFontSize(12);
    doc.setTextColor(16, 185, 129);
    doc.text(`${formatCurrency(currentBalance)}`, 227, 68);

    const tableData = [
      ['Date', 'Description', 'Bags', 'Gross', 'Ded.', 'Net', 'Price', 'Credit (+)', 'Debit (-)', 'Balance'],
      [startDate ? new Date(startDate).toLocaleDateString() : 'N/A', 'Balance Brought Forward', '-', '-', '-', '-', '-', `${formatCurrency(ledgerEntries.bbf)}`, '-', `${formatCurrency(ledgerEntries.bbf)}`]
    ];

    let runningBalance = ledgerEntries.bbf || 0;
    // We need to reverse back to chronological for the PDF table calculation if it was reversed for UI
    const chronologicalEntries = [...ledgerEntries.entries].reverse();
    let totalCredit = 0;
    let totalDebit = 0;
    
    chronologicalEntries.forEach(entry => {
      totalCredit = roundTo(totalCredit + (entry.credit || 0), 2);
      totalDebit = roundTo(totalDebit + (entry.debit || 0), 2);
      runningBalance = roundTo(runningBalance + ((entry.credit || 0) - (entry.debit || 0)), 2);

      let deductionBreakdown = '';
      if (entry.deductions) {
        const d = entry.deductions;
        const mLoss = roundTo(((d.moistureActual - d.moistureBenchmark) * (entry.grossWeight || 0)) / 100, 2);
        const parts = [];
        if (mLoss > 0) parts.push(`Moisture: ${formatNumber(mLoss)}kg`);
        if (d.tareWeight > 0) parts.push(`Tare: ${formatNumber(d.tareWeight)}kg`);
        if (d.moldWeight > 0) parts.push(`Mold: ${formatNumber(d.moldWeight)}kg`);
        if (d.otherDeduction > 0) parts.push(`Other: ${formatNumber(d.otherDeduction)}kg`);
        deductionBreakdown = parts.join(', ');
      }

      tableData.push([
        entry.date ? new Date(entry.date).toLocaleDateString() : 'N/A',
        entry.description + (deductionBreakdown ? `\n(${deductionBreakdown})` : ''),
        (entry.bags || 0) > 0 ? entry.bags.toString() : '-',
        (entry.grossWeight || 0) > 0 ? `${formatNumber(entry.grossWeight)}kg` : '-',
        (entry.deductionWeight || 0) > 0 ? `${formatNumber(entry.deductionWeight)}kg` : '-',
        (entry.netWeight || 0) > 0 ? `${formatNumber(entry.netWeight)}kg` : '-',
        (entry.pricePerKg || 0) > 0 ? `${formatCurrency(entry.pricePerKg)}` : '-',
        (entry.credit || 0) > 0 ? `${formatCurrency(entry.credit)}` : '-',
        (entry.debit || 0) > 0 ? `${formatCurrency(entry.debit)}` : '-',
        `${formatCurrency(runningBalance)}`
      ]);
    });

    autoTable(doc, {
      startY: 85,
      margin: { left: 15, right: 15 },
      head: [tableData[0]],
      body: tableData.slice(1),
      foot: [
        ['TOTAL', '', '', '', '', '', '', `${formatCurrency(totalCredit)}`, `${formatCurrency(totalDebit)}`, `${formatCurrency(runningBalance)}`]
      ],
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontSize: 7.5, fontStyle: 'bold' },
      footStyles: { fillColor: [243, 244, 246], textColor: [31, 41, 55], fontSize: 7.5, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7 },
      styles: { cellPadding: 1.2, overflow: 'linebreak' },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 10, halign: 'center' },
        3: { cellWidth: 16, halign: 'left' },
        4: { cellWidth: 16, halign: 'left' },
        5: { cellWidth: 16, halign: 'left' },
        6: { cellWidth: 20, halign: 'left' },
        7: { cellWidth: 35, halign: 'left' },
        8: { cellWidth: 35, halign: 'left' },
        9: { cellWidth: 38, halign: 'left', fontStyle: 'bold' }
      }
    });

    doc.save(`${currentSupplier.name}_Ledger_${new Date().toISOString().split('T')[0]}.pdf`);
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
          details: `Adjusted transaction ${editingEntry.originalDoc.referenceId}: set gross weight to ${grossVal}kg, net to ${calculatedNet}kg, price to ₦${priceVal}/kg, total value to ₦${calculatedTotal}`,
          previousData: editingEntry.originalDoc,
          newData: updatedTx
        }).catch(err => console.error('Failed to log audit:', err));

      } else if (editingEntry.entryType === 'PAYMENT') {
        const docRef = doc(db, 'payments', editingEntry.id);
        const amountVal = Number(formData.get('amount') || 0);
        const methodVal = formData.get('method') as string;
        const refVal = formData.get('reference') as string;
        const descVal = formData.get('description') as string;
        const isAdvance = formData.get('isAdvance') === 'on';

        const updatedPayment = {
          ...editingEntry.originalDoc,
          date: dateIso,
          amount: amountVal,
          method: methodVal,
          reference: refVal,
          description: isAdvance ? `[ADVANCE] ${descVal}` : descVal
        };

        await setDoc(docRef, updatedPayment);

        // Record Audit Log
        await recordAuditLog({
          companyId: profile.companyId,
          userId: profile.uid,
          userEmail: profile.email,
          action: AuditAction.UPDATE,
          module: 'Payments',
          recordId: editingEntry.id,
          details: `Adjusted payment of ₦${amountVal} (Ref: ${refVal}) for supplier: ${supplier.name}`,
          previousData: editingEntry.originalDoc,
          newData: updatedPayment
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
          details: `Adjusted journal ${editingEntry.originalDoc.type?.toLowerCase() || 'entry'} of ₦${amountVal} linked to supplier: ${supplier.name}`,
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

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Success Toast */}
      <AnimatePresence>
        {successMessage && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-4 right-4 bg-emerald-600 text-white p-4 rounded-2xl shadow-2xl z-[100] flex items-center gap-3"
          >
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <Plus size={18} className="rotate-45" />
            </div>
            <p className="font-bold text-sm">{successMessage}</p>
          </motion.div>
        )}
        {errorMessage && (
          <Toast 
            message={errorMessage} 
            type="error" 
            onClose={() => setErrorMessage(null)} 
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-20">
        <div className="text-center mb-4 pb-4 border-b border-slate-100">
          <h2 className="text-xl font-black text-emerald-600 tracking-tighter uppercase">{company?.name || 'CCS COMMODITY CONTROL SYSTEM'}</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Commodity Trading & Logistics</p>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="p-2 -ml-2 text-slate-400 hover:text-slate-900">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900">{currentSupplier.name}</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">{currentSupplier.location}</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
            <p className="text-[9px] font-bold text-emerald-600 uppercase mb-1">Current Balance</p>
            <p className={cn(
              "text-lg font-black",
              (currentBalance || 0) >= 0 ? "text-emerald-700" : "text-rose-700"
            )}>
              {formatCurrency(currentBalance || 0)}
            </p>
          </div>
          <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100">
            <p className="text-[9px] font-bold text-blue-600 uppercase mb-1">Bag Balance</p>
            <p className="text-lg font-black text-blue-700">{(bagBalance || 0)} <span className="text-xs font-normal">bags</span></p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {[
            { id: 'ledger', label: 'Ledger', icon: FileText },
            { id: 'bags', label: 'Bags', icon: Package },
            { id: 'payments', label: 'Payments', icon: Wallet },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all",
                activeTab === tab.id ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400"
              )}
            >
              <tab.icon size={14} /> {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-24">
        <AnimatePresence mode="wait">
          {activeTab === 'ledger' && (
            <motion.div key="ledger" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase mb-2">
                  <Calendar size={14} /> Date Filter
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[8px] font-bold text-slate-400 uppercase mb-1">From</label>
                    <input 
                      type="date" 
                      value={startDate} 
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-bold text-slate-400 uppercase mb-1">To</label>
                    <input 
                      type="date" 
                      value={endDate} 
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none" 
                    />
                  </div>
                </div>
              </div>

              {/* Quick actions for Supplier ledger */}
              {(isStaff || isAccount || isAdmin) && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => setIsAddingPurchaseReturn(true)}
                    className="flex-1 flex items-center justify-center gap-1 text-xs font-black text-rose-600 bg-rose-50 hover:bg-rose-100 py-2.5 rounded-xl border border-rose-200 transition-all shadow-sm hover:scale-[1.02]"
                  >
                    <Plus size={14} /> Purchase Return
                  </button>
                  {(isAccount || isAdmin) && (
                    <button 
                      onClick={() => setIsAddingSupplierCharge(true)}
                      className="flex-1 flex items-center justify-center gap-1 text-xs font-black text-amber-600 bg-amber-50 hover:bg-amber-100 py-2.5 rounded-xl border border-amber-200 transition-all shadow-sm hover:scale-[1.02]"
                    >
                      <Plus size={14} /> Supplier Charge
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Transaction History</h2>
                <button 
                  onClick={exportPDF}
                  className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg"
                >
                  <Download size={14} /> PDF
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-slate-900 rounded-2xl shadow-lg text-white mb-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase opacity-60">Balance Brought Forward</p>
                    <p className="text-[8px] opacity-40 uppercase tracking-widest">As at {startDate ? new Date(startDate).toLocaleDateString() : 'N/A'}</p>
                  </div>
                  <p className="text-lg font-black">{formatCurrency(ledgerEntries.bbf || 0)}</p>
                </div>

                <div className="space-y-3">
                  {ledgerEntries.entries.map((entry, i) => (
                    <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-200 transition-colors">
                      <div className="flex justify-between items-start">
                        <div className="flex gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                            (entry.credit || 0) > 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                          )}>
                            {(entry.credit || 0) > 0 ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate">
                              {(entry.description || '').includes('[ADVANCE]') ? (
                                <span className="flex items-center gap-1">
                                  <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[8px] font-black uppercase">Advance</span>
                                  {(entry.description || '').replace('[ADVANCE] ', '')}
                                </span>
                              ) : entry.description}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-[10px] font-medium text-slate-400">
                                {entry.date ? new Date(entry.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                              </p>
                              {(entry.grossWeight || 0) > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  <span className="text-[8px] font-bold text-blue-600 bg-blue-50 px-1 rounded">Bags: {formatNumber(entry.bags, 0)}</span>
                                  <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded">Net: {formatNumber(entry.netWeight)}kg</span>
                                </div>
                              )}
                            </div>
                            {(entry.grossWeight || 0) > 0 && (
                              <div className="mt-2 space-y-2">
                                  <div className="grid grid-cols-3 gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                                    <div>
                                      <p className="text-[7px] text-slate-400 uppercase font-bold">Gross</p>
                                      <p className="text-[9px] font-black text-slate-700">{formatNumber(entry.grossWeight)}kg</p>
                                    </div>
                                    <div>
                                      <p className="text-[7px] text-slate-400 uppercase font-bold">Ded.</p>
                                      <p className="text-[9px] font-black text-rose-600">{formatNumber(entry.deductionWeight)}kg</p>
                                    </div>
                                    <div>
                                      <p className="text-[7px] text-slate-400 uppercase font-bold">Price</p>
                                      <p className="text-[9px] font-black text-amber-600">{formatCurrency(entry.pricePerKg || 0)}</p>
                                    </div>
                                  </div>
                                
                                {entry.deductions && (
                                  <div className="flex flex-wrap gap-2 px-1">
                                      {((entry.deductions.moistureActual - entry.deductions.moistureBenchmark) * (entry.grossWeight || 0) / 100) > 0 && (
                                        <span className="text-[8px] text-slate-500">
                                          Moisture: <span className="font-bold text-rose-500">{formatNumber(((entry.deductions.moistureActual - entry.deductions.moistureBenchmark) * (entry.grossWeight || 0)) / 100)}kg</span>
                                        </span>
                                      )}
                                      {entry.deductions.tareWeight > 0 && (
                                        <span className="text-[8px] text-slate-500">
                                          Tare: <span className="font-bold text-rose-500">{formatNumber(entry.deductions.tareWeight)}kg</span>
                                        </span>
                                      )}
                                      {entry.deductions.moldWeight > 0 && (
                                        <span className="text-[8px] text-slate-500">
                                          Mold: <span className="font-bold text-rose-500">{formatNumber(entry.deductions.moldWeight)}kg</span>
                                        </span>
                                      )}
                                      {entry.deductions.otherDeduction > 0 && (
                                        <span className="text-[8px] text-slate-500">
                                          Other: <span className="font-bold text-rose-500">{formatNumber(entry.deductions.otherDeduction)}kg</span>
                                        </span>
                                      )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-4">
                          <p className={cn(
                            "text-base font-black leading-none",
                            (entry.credit || 0) > 0 ? "text-emerald-600" : "text-rose-600"
                          )}>
                            {(entry.credit || 0) > 0 ? '+' : '-'}{formatCurrency((entry.debit || 0) || (entry.credit || 0))}
                          </p>
                          <p className="text-[8px] text-slate-400 uppercase font-bold tracking-tighter mt-1">
                            {entry.credit > 0 ? 'Purchase' : entry.debit > 0 ? (entry.description.includes('Sale') ? 'Sale' : 'Payment/Charge') : 'Transaction'}
                          </p>
                          <div className="mt-2 pt-1 border-t border-slate-100">
                            <p className="text-[7px] text-slate-400 uppercase font-bold">Balance</p>
                            <p className="text-[10px] font-black text-slate-600">{formatCurrency(entry.runningBalance || 0)}</p>
                          </div>
                          {isAdmin && (
                            <button
                              onClick={() => setEditingEntry({
                                id: entry.id,
                                entryType: entry.entryType,
                                originalDoc: entry.originalDoc
                              })}
                              className="mt-2 text-[10px] text-emerald-600 font-black hover:text-emerald-700 hover:underline flex items-center gap-1 justify-end ml-auto"
                              title="Adjust Entry"
                            >
                              <Edit2 size={10} /> Adjust
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'bags' && (
            <motion.div key="bags" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Bag Tracking</h2>
                {isStaff && (
                  <button 
                    onClick={() => setIsAddingBagTx(true)}
                    className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg"
                  >
                    <Plus size={14} /> Issue/Return
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {bagTransactions.map((bt) => (
                  <div key={bt.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        bt.type === 'ISSUE' ? "bg-blue-50 text-blue-600" : "bg-slate-50 text-slate-600"
                      )}>
                        <Package size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{bt.type === 'ISSUE' ? 'Issued Bags' : 'Returned Bags'}</p>
                        <p className="text-[10px] text-slate-400">{bt.date ? new Date(bt.date).toLocaleDateString() : 'N/A'} • Ref: {bt.reference || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        "text-lg font-black",
                        bt.type === 'ISSUE' ? "text-blue-600" : "text-slate-600"
                      )}>
                        {bt.type === 'ISSUE' ? '+' : '-'}{formatNumber(bt.quantity || 0, 0)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'payments' && (
            <motion.div key="payments" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Direct Payments</h2>
                {(isAccount || isAdmin) && (
                  <button 
                    onClick={() => setIsAddingPayment(true)}
                    className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg"
                  >
                    <Plus size={14} /> New Payment
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {payments.map((p) => (
                  <div key={p.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                          <Wallet size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{p.method}</p>
                          <p className="text-[10px] text-slate-400">{p.date ? new Date(p.date).toLocaleDateString() : 'N/A'} • {p.description || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-emerald-600">{formatCurrency(p.amount || 0)}</p>
                        <p className="text-[9px] text-slate-400 uppercase tracking-tighter">Paid</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {isAddingPayment && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ y: "100%" }} 
              animate={{ y: 0 }} 
              exit={{ y: "100%" }}
              className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl"
            >
              <h2 className="text-xl font-bold mb-6">Record Payment</h2>
              <form onSubmit={handleAddPayment} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Warehouse</label>
                    <select name="warehouseId" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm">
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Transaction Date</label>
                    <input 
                      name="transactionDate" 
                      type="date" 
                      required 
                      defaultValue={(() => {
                        const d = new Date();
                        const year = d.getFullYear();
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        return `${year}-${month}-${day}`;
                      })()}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Amount (₦)</label>
                  <DigitFormattedInput 
                    name="amount" 
                    required 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" 
                    placeholder="0.00" 
                    prefix="₦"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Method</label>
                  <select name="method" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none">
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CHECK">Check</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Reference / Description</label>
                  <input name="description" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="e.g. Payment for Cocoa" />
                  <input name="reference" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none mt-2" placeholder="Ref ID (optional)" />
                </div>
                <div className="flex items-center gap-2 bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                  <input type="checkbox" name="isAdvance" id="isAdvance" className="w-4 h-4 accent-emerald-600" />
                  <label htmlFor="isAdvance" className="text-xs font-bold text-emerald-700">Mark as Advance Payment</label>
                </div>
                <div className="flex gap-3 mt-6">
                  <button type="button" onClick={() => setIsAddingPayment(false)} className="flex-1 py-4 text-slate-500 font-bold">Cancel</button>
                  <button 
                    type="submit" 
                    disabled={submitting}
                    className="flex-2 bg-emerald-600 text-white py-4 rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting ? 'Saving...' : 'Save Payment'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isAddingBagTx && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ y: "100%" }} 
              animate={{ y: 0 }} 
              exit={{ y: "100%" }}
              className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl"
            >
              <h2 className="text-xl font-bold mb-6">Bag Transaction</h2>
              <form onSubmit={handleAddBagTx} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Transaction Type</label>
                  <select name="type" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none">
                    <option value="ISSUE">Issue Bags to Supplier</option>
                    <option value="RETURN">Return Bags from Supplier</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Warehouse</label>
                  <select name="warehouseId" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none">
                    <option value="">Select Warehouse</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bag Type</label>
                  <select name="packagingType" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none">
                    <option value="JUTE_BAG">Jute Bag</option>
                    <option value="NYLON_BAG">Nylon Bag</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Quantity (Bags)</label>
                  <DigitFormattedInput 
                    name="quantity" 
                    required 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" 
                    placeholder="0" 
                    suffix="bags"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Reference</label>
                  <input name="reference" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="e.g. Waybill ID" />
                </div>
                <div className="flex gap-3 mt-6">
                  <button type="button" onClick={() => setIsAddingBagTx(false)} className="flex-1 py-4 text-slate-500 font-bold">Cancel</button>
                  <button 
                    type="submit" 
                    disabled={submitting}
                    className="flex-2 bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting ? 'Confirming...' : 'Confirm'}
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
              className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl my-auto"
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

                {editingEntry.entryType === 'PAYMENT' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Amount (₦)</label>
                        <DigitFormattedInput name="amount" required defaultValue={editingEntry.originalDoc.amount} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium" prefix="₦" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Method</label>
                        <select name="method" required defaultValue={editingEntry.originalDoc.method} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium">
                          <option value="CASH">Cash</option>
                          <option value="BANK_TRANSFER">Bank Transfer</option>
                          <option value="CHECK">Check</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Reference ID</label>
                      <input name="reference" defaultValue={editingEntry.originalDoc.reference || ''} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Description / Notes</label>
                      <input 
                        name="description" 
                        required 
                        defaultValue={editingEntry.originalDoc.description ? editingEntry.originalDoc.description.replace('[ADVANCE] ', '') : ''} 
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium" 
                      />
                    </div>
                    <div className="flex items-center gap-2 bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                      <input 
                        type="checkbox" 
                        name="isAdvance" 
                        id="isAdvance" 
                        defaultChecked={editingEntry.originalDoc.description?.startsWith('[ADVANCE]')} 
                        className="w-4 h-4 accent-emerald-600" 
                      />
                      <label htmlFor="isAdvance" className="text-xs font-bold text-emerald-700">Mark as Advance Payment</label>
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
                    className="flex-2 bg-emerald-600 text-white py-4 rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm font-medium"
                  >
                    {submitting ? 'Saving Changes...' : 'Save Adjustments'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isAddingPurchaseReturn && (
          <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ y: "100%" }} 
              animate={{ y: 0 }} 
              exit={{ y: "100%" }}
              className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl my-auto"
            >
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-rose-600">
                <Plus className="rotate-45" size={24} /> New Purchase Return
              </h2>
              <form onSubmit={handleAddPurchaseReturn} className="space-y-4">
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
                  <input name="notes" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium" placeholder="Reason for the return..." />
                </div>
                <div className="flex gap-3 mt-6">
                  <button type="button" onClick={() => setIsAddingPurchaseReturn(false)} className="flex-1 py-4 text-slate-500 font-bold text-sm">Cancel</button>
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

        {isAddingSupplierCharge && (
          <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ y: "100%" }} 
              animate={{ y: 0 }} 
              exit={{ y: "100%" }}
              className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl my-auto"
            >
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-amber-600">
                <Plus className="rotate-45" size={24} /> New Supplier Charge
              </h2>
              <form onSubmit={handleAddSupplierCharge} className="space-y-4">
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
                  <button type="button" onClick={() => setIsAddingSupplierCharge(false)} className="flex-1 py-4 text-slate-500 font-bold text-sm">Cancel</button>
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
