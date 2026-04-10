/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Download, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Calendar, 
  Warehouse as WarehouseIcon,
  Filter,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRightLeft,
  ShieldCheck,
  Edit2,
  Plus,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Supplier, Transaction, Payment, JournalEntry, Warehouse, Buyer, BagTransaction, PackagingType, AuditLog } from '../types';
import { useAuth } from '../contexts/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { handleFirestoreError, reportFirestoreError, formatFirestoreError, OperationType } from '../lib/firestore';
import Toast from './Toast';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type ReportType = 'supplier_balances' | 'buyer_balances' | 'operational_purchases' | 'operational_sales' | 'packaging_inventory' | 'transfers' | 'search' | 'audit_logs';

export default function ReportsModule() {
  const { profile, company } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [bagTransactions, setBagTransactions] = useState<BagTransaction[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [activeReport, setActiveReport] = useState<ReportType>('supplier_balances');
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Load Data from Firestore
  useEffect(() => {
    if (!profile?.companyId) return;

    const qSuppliers = query(
      collection(db, 'suppliers'), 
      where('companyId', '==', profile.companyId),
      orderBy('name', 'asc')
    );
    const unsubscribeSuppliers = onSnapshot(qSuppliers, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Supplier));
      setSuppliers(data);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'suppliers')));

    const qBuyers = query(
      collection(db, 'buyers'), 
      where('companyId', '==', profile.companyId),
      orderBy('name', 'asc')
    );
    const unsubscribeBuyers = onSnapshot(qBuyers, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Buyer));
      setBuyers(data);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'buyers')));

    const qWarehouses = query(
      collection(db, 'warehouses'), 
      where('companyId', '==', profile.companyId),
      orderBy('name', 'asc')
    );
    const unsubscribeWarehouses = onSnapshot(qWarehouses, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Warehouse));
      setWarehouses(data);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'warehouses')));

    const qTx = query(
      collection(db, 'transactions'), 
      where('companyId', '==', profile.companyId),
      orderBy('date', 'desc')
    );
    const unsubscribeTx = onSnapshot(qTx, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Transaction));
      setTransactions(data);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'transactions')));

    const qPayments = query(
      collection(db, 'payments'), 
      where('companyId', '==', profile.companyId),
      orderBy('date', 'desc')
    );
    const unsubscribePayments = onSnapshot(qPayments, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Payment));
      setPayments(data);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'payments')));

    const qAuditLogs = query(
      collection(db, 'audit_logs'),
      where('companyId', '==', profile.companyId),
      orderBy('timestamp', 'desc')
    );
    const unsubscribeAuditLogs = onSnapshot(qAuditLogs, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AuditLog));
      setAuditLogs(data);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'audit_logs')));

    const qJournal = query(
      collection(db, 'journal'), 
      where('companyId', '==', profile.companyId),
      orderBy('date', 'desc')
    );
    const unsubscribeJournal = onSnapshot(qJournal, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as JournalEntry));
      setJournal(data);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'journal')));

    const qBags = query(
      collection(db, 'bag_transactions'), 
      where('companyId', '==', profile.companyId),
      orderBy('date', 'desc')
    );
    const unsubscribeBags = onSnapshot(qBags, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as BagTransaction));
      setBagTransactions(data);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'bag_transactions')));

    return () => {
      unsubscribeSuppliers();
      unsubscribeBuyers();
      unsubscribeWarehouses();
      unsubscribeTx();
      unsubscribePayments();
      unsubscribeAuditLogs();
      unsubscribeJournal();
      unsubscribeBags();
    };
  }, [profile?.companyId]);

  // Supplier Balances Report Logic
  const supplierBalances = useMemo(() => {
    return suppliers.map(s => {
      const sPurchases = transactions.filter(t => t.supplierId === s.id && t.type === 'PURCHASE' && t.date.split('T')[0] <= endDate);
      const sSales = transactions.filter(t => t.supplierId === s.id && t.type === 'SALE' && t.date.split('T')[0] <= endDate);
      const sPay = payments.filter(p => p.supplierId === s.id && p.date.split('T')[0] <= endDate);
      const sExp = journal.filter(e => e.supplierId === s.id && e.type === 'OUTFLOW' && e.date.split('T')[0] <= endDate);
      
      const totalPurchases = sPurchases.reduce((sum, t) => sum + (t.totalValue || 0), 0);
      const totalSales = sSales.reduce((sum, t) => sum + (t.totalValue || 0), 0);
      const totalPayments = sPay.reduce((sum, p) => sum + p.amount, 0);
      const totalCharges = sExp.reduce((sum, e) => sum + e.amount, 0);
      
      const balance = (s.previousBalance || 0) + totalPurchases - totalSales - totalPayments - totalCharges;
      return { ...s, balance };
    });
  }, [suppliers, transactions, payments, journal, endDate]);

  const creditSuppliers = supplierBalances.filter(s => s.balance > 0); // We owe them (Accounts Payable)
  const debitSuppliers = supplierBalances.filter(s => s.balance < 0); // They owe us (Accounts Receivable)

  const totalCreditBalance = useMemo(() => creditSuppliers.reduce((sum, s) => sum + s.balance, 0), [creditSuppliers]);
  const totalDebitBalance = useMemo(() => debitSuppliers.reduce((sum, s) => sum + Math.abs(s.balance), 0), [debitSuppliers]);

  // Buyer Balances Report Logic
  const buyerBalances = useMemo(() => {
    return buyers.map(b => {
      const bSales = transactions.filter(t => t.buyerId === b.id && t.type === 'SALE' && t.date.split('T')[0] <= endDate);
      const bPayments = journal.filter(e => e.buyerId === b.id && e.type === 'INFLOW' && e.date.split('T')[0] <= endDate);
      
      const totalSales = bSales.reduce((sum, t) => sum + (t.totalValue || 0), 0);
      const totalPayments = bPayments.reduce((sum, p) => sum + p.amount, 0);
      
      const balance = (b.previousBalance || 0) + totalSales - totalPayments;
      return { ...b, balance };
    });
  }, [buyers, transactions, journal, endDate]);

  const debitBuyers = buyerBalances.filter(b => b.balance > 0); // They owe us (Accounts Receivable)
  const creditBuyers = buyerBalances.filter(b => b.balance < 0); // We owe them (Accounts Payable)

  const totalBuyerDebit = useMemo(() => debitBuyers.reduce((sum, b) => sum + b.balance, 0), [debitBuyers]);
  const totalBuyerCredit = useMemo(() => creditBuyers.reduce((sum, b) => sum + Math.abs(b.balance), 0), [creditBuyers]);

  // Packaging Inventory Logic
  const packagingInventory = useMemo(() => {
    const summary: Record<string, number> = {
      'JUTE_BAG': 0,
      'NYLON_BAG': 0
    };

    bagTransactions.forEach(tx => {
      const date = tx.date.split('T')[0];
      if (date > endDate) return;

      if (tx.type === 'TRANSFER') {
        if (selectedWarehouseId === 'ALL') return;
        if (tx.sourceWarehouseId === selectedWarehouseId) summary[tx.packagingType] -= tx.quantity;
        if (tx.destinationWarehouseId === selectedWarehouseId) summary[tx.packagingType] += tx.quantity;
      } else {
        if (selectedWarehouseId !== 'ALL' && tx.warehouseId !== selectedWarehouseId) return;
        if (tx.type === 'STOCK_IN' || tx.type === 'RETURN') summary[tx.packagingType] += tx.quantity;
        if (tx.type === 'ISSUE') summary[tx.packagingType] -= tx.quantity;
      }
    });

    return summary;
  }, [bagTransactions, endDate, selectedWarehouseId]);

  // Operational Reports Logic
  const filteredOperationalTx = useMemo(() => {
    return transactions.filter(t => {
      const date = new Date(t.date).toISOString().split('T')[0];
      const dateMatch = date >= startDate && date <= endDate;
      const warehouseMatch = selectedWarehouseId === 'ALL' || t.warehouseId === selectedWarehouseId;
      const typeMatch = activeReport === 'operational_purchases' ? t.type === 'PURCHASE' : t.type === 'SALE';
      return dateMatch && warehouseMatch && typeMatch;
    });
  }, [transactions, startDate, endDate, selectedWarehouseId, activeReport]);

  const filteredTransfers = useMemo(() => {
    const commodityTransfers = transactions.filter(t => {
      if (t.type !== 'TRANSFER') return false;
      const date = new Date(t.date).toISOString().split('T')[0];
      const dateMatch = date >= startDate && date <= endDate;
      const warehouseMatch = selectedWarehouseId === 'ALL' || 
                             t.sourceWarehouseId === selectedWarehouseId || 
                             t.destinationWarehouseId === selectedWarehouseId;
      return dateMatch && warehouseMatch;
    }).map(t => ({
      ...t,
      transferType: 'COMMODITY' as const
    }));

    const bagTransfers = bagTransactions.filter(t => {
      if (t.type !== 'TRANSFER') return false;
      const date = t.date.split('T')[0];
      const dateMatch = date >= startDate && date <= endDate;
      const warehouseMatch = selectedWarehouseId === 'ALL' || 
                             t.sourceWarehouseId === selectedWarehouseId || 
                             t.destinationWarehouseId === selectedWarehouseId;
      return dateMatch && warehouseMatch;
    }).map(t => ({
      ...t,
      transferType: 'BAG' as const
    }));

    return [...commodityTransfers, ...bagTransfers].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [transactions, bagTransactions, startDate, endDate, selectedWarehouseId]);

  const generatePDF = () => {
    const doc = new jsPDF(activeReport === 'supplier_balances' ? 'p' : 'l');
    const timestamp = new Date().toLocaleString();
    
    // Company Header
    doc.setFontSize(22);
    doc.setTextColor(16, 185, 129); // Emerald-600
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.text(company?.name?.toUpperCase() || 'CCS COMMODITY CONTROL SYSTEM', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Financial & Commodity Management Solutions', pageWidth / 2, 26, { align: 'center' });
    
    doc.setDrawColor(200);
    doc.line(14, 32, pageWidth - 14, 32);

    doc.setFontSize(14);
    doc.setTextColor(0);
    
    let title = '';
    let tableData: any[] = [];
    let tableHeaders: string[] = [];

    if (activeReport === 'search') {
      title = `Transaction Search Results for: ${searchQuery}`;
      tableHeaders = ['Date', 'Type', 'Tranx ID', 'Entity', 'Commodity', 'Net Weight', 'Value (NGN)'];
      tableData = transactions
        .filter(t => t.storeRecordId?.toLowerCase().includes(searchQuery.toLowerCase()))
        .map(t => [
          new Date(t.date).toLocaleDateString(),
          t.type,
          t.storeRecordId || '-',
          t.type === 'PURCHASE' 
            ? (suppliers.find(s => s.id === t.supplierId)?.name || 'Unknown')
            : (buyers.find(b => b.id === t.buyerId)?.name || t.buyerName || 'Unknown'),
          t.commodity,
          `${t.netWeight}kg`,
          (t.totalValue || 0).toLocaleString()
        ]);
    } else if (activeReport === 'supplier_balances') {
      title = `Supplier Balances Report (As at ${endDate})`;
      tableHeaders = ['Supplier Name', 'Location', 'Balance (NGN)', 'Type'];
      tableData = supplierBalances.map(s => [
        s.name,
        s.location,
        Math.abs(s.balance).toLocaleString(),
        s.balance > 0 ? 'CREDIT (We Owe)' : s.balance < 0 ? 'DEBIT (They Owe)' : 'SETTLED'
      ]);
    } else if (activeReport === 'buyer_balances') {
      title = `Customer Balances Report (As at ${endDate})`;
      tableHeaders = ['Customer Name', 'Location', 'Balance (NGN)', 'Type'];
      tableData = buyerBalances.map(b => [
        b.name,
        b.location,
        Math.abs(b.balance).toLocaleString(),
        b.balance > 0 ? 'DEBIT (They Owe)' : b.balance < 0 ? 'CREDIT (We Owe)' : 'SETTLED'
      ]);
    } else if (activeReport === 'packaging_inventory') {
      title = `Packaging Inventory Report (As at ${endDate})`;
      tableHeaders = ['Packaging Type', 'Warehouse', 'Current Stock (Units)'];
      
      const warehouseName = selectedWarehouseId === 'ALL' ? 'All Warehouses' : warehouses.find(w => w.id === selectedWarehouseId)?.name || 'Unknown';
      tableData = Object.entries(packagingInventory).map(([type, qty]) => [
        type?.replace('_', ' ') || 'N/A',
        warehouseName,
        qty.toLocaleString()
      ]);
    } else if (activeReport === 'transfers') {
      title = `Stock Transfers Report (${startDate} to ${endDate})`;
      tableHeaders = ['Date', 'Type', 'Item', 'From', 'To', 'Quantity/Weight'];
      tableData = filteredTransfers.map(t => [
        new Date(t.date).toLocaleDateString(),
        t.transferType,
        t.transferType === 'COMMODITY' ? (t as Transaction).commodity : (t as BagTransaction).packagingType.replace('_', ' '),
        warehouses.find(w => w.id === t.sourceWarehouseId)?.name || 'Unknown',
        warehouses.find(w => w.id === t.destinationWarehouseId)?.name || 'Unknown',
        t.transferType === 'COMMODITY' ? `${(t as Transaction).netWeight}kg` : `${(t as BagTransaction).quantity} units`
      ]);
    } else {
      title = activeReport === 'operational_purchases' ? 'Purchases Operational Report' : 'Sales Operational Report';
      tableHeaders = ['Date', 'Ref ID', 'Commodity', 'Warehouse', 'Bags', 'Gross', 'Ded', 'Net', 'Price/kg', 'Value (NGN)'];
      tableData = filteredOperationalTx.map(t => {
        let deductionBreakdown = '';
        if (t.deductions) {
          const d = t.deductions;
          const mLoss = ((d.moistureActual - d.moistureBenchmark) * (t.grossWeight || 0)) / 100;
          const parts = [];
          if (mLoss > 0) parts.push(`M: ${mLoss.toFixed(2)}kg`);
          if (d.tareWeight > 0) parts.push(`T: ${d.tareWeight}kg`);
          if (d.moldWeight > 0) parts.push(`Q: ${d.moldWeight}kg`);
          if (d.otherDeduction > 0) parts.push(`O: ${d.otherDeduction}kg`);
          deductionBreakdown = parts.join(', ');
        }

        return [
          new Date(t.date).toLocaleDateString(),
          t.referenceId,
          t.commodity,
          warehouses.find(w => w.id === t.warehouseId)?.name || t.warehouse || 'Main',
          t.noOfBags || t.bags || '-',
          `${t.grossWeight}kg`,
          `${(t.grossWeight - t.netWeight).toFixed(2)}kg${deductionBreakdown ? `\n(${deductionBreakdown})` : ''}`,
          `${t.netWeight}kg`,
          t.pricePerKg ? `NGN ${t.pricePerKg.toLocaleString()}` : '-',
          (t.totalValue || 0).toLocaleString()
        ];
      });
    }

    doc.text(title, 14, 42);
    doc.setFontSize(10);
    doc.text(`Generated on: ${timestamp}`, 14, 48);
    
    if (activeReport !== 'supplier_balances' && activeReport !== 'buyer_balances' && activeReport !== 'search') {
      const warehouseName = selectedWarehouseId === 'ALL' ? 'All Warehouses' : warehouses.find(w => w.id === selectedWarehouseId)?.name || 'Unknown';
      doc.text(`Period: ${startDate} to ${endDate} | Warehouse: ${warehouseName}`, 14, 54);
    }

    autoTable(doc, {
      startY: (activeReport === 'supplier_balances' || activeReport === 'buyer_balances' || activeReport === 'search') ? 52 : 60,
      head: [tableHeaders],
      body: tableData,
      foot: activeReport === 'supplier_balances' ? [
        ['TOTAL CREDIT (WE OWE)', '', totalCreditBalance.toLocaleString(), ''],
        ['TOTAL DEBIT (THEY OWE)', '', totalDebitBalance.toLocaleString(), '']
      ] : activeReport === 'buyer_balances' ? [
        ['TOTAL DEBIT (THEY OWE)', '', totalBuyerDebit.toLocaleString(), ''],
        ['TOTAL CREDIT (WE OWE)', '', totalBuyerCredit.toLocaleString(), '']
      ] : (activeReport === 'operational_purchases' || activeReport === 'operational_sales') ? [
        ['TOTAL', '', '', '', 
          filteredOperationalTx.reduce((sum, t) => sum + (t.noOfBags || t.bags || 0), 0).toLocaleString(),
          `${filteredOperationalTx.reduce((sum, t) => sum + t.grossWeight, 0).toLocaleString()}kg`,
          `${filteredOperationalTx.reduce((sum, t) => sum + (t.grossWeight - t.netWeight), 0).toFixed(2)}kg`,
          `${filteredOperationalTx.reduce((sum, t) => sum + t.netWeight, 0).toLocaleString()}kg`,
          '',
          filteredOperationalTx.reduce((sum, t) => sum + (t.totalValue || 0), 0).toLocaleString()
        ]
      ] : undefined,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
      footStyles: { fillColor: [243, 244, 246], textColor: [31, 41, 55], fontStyle: 'bold' },
      styles: { fontSize: 8 },
      columnStyles: (activeReport === 'supplier_balances' || activeReport === 'buyer_balances') ? {
        2: { halign: 'right' }
      } : {
        4: { halign: 'center' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'right' },
        9: { halign: 'right' }
      }
    });

    doc.save(`${activeReport}_${new Date().getTime()}.pdf`);
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
      </AnimatePresence>
      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-slate-900">Reports Module</h1>
          <button
            onClick={generatePDF}
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-sm font-bold active:scale-95 transition-all"
          >
            <Download size={18} /> Export PDF
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setActiveReport('supplier_balances')}
            className={cn(
              "px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap",
              activeReport === 'supplier_balances' ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
            )}
          >
            Supplier Balances
          </button>
          <button
            onClick={() => setActiveReport('buyer_balances')}
            className={cn(
              "px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap",
              activeReport === 'buyer_balances' ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
            )}
          >
            Customer Balances
          </button>
          <button
            onClick={() => setActiveReport('operational_purchases')}
            className={cn(
              "px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap",
              activeReport === 'operational_purchases' ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
            )}
          >
            Purchases
          </button>
          <button
            onClick={() => setActiveReport('operational_sales')}
            className={cn(
              "px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap",
              activeReport === 'operational_sales' ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
            )}
          >
            Sales
          </button>
          <button
            onClick={() => setActiveReport('packaging_inventory')}
            className={cn(
              "px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap",
              activeReport === 'packaging_inventory' ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
            )}
          >
            Packaging
          </button>
          <button
            onClick={() => setActiveReport('transfers')}
            className={cn(
              "px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap",
              activeReport === 'transfers' ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
            )}
          >
            Transfers
          </button>
          <button
            onClick={() => setActiveReport('search')}
            className={cn(
              "px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5",
              activeReport === 'search' ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
            )}
          >
            <Search size={12} /> Search Tranx ID
          </button>
          {(profile?.role === 'ADMIN' || profile?.role === 'AUDITOR' || profile?.role === 'MANAGER') && (
            <button
              onClick={() => setActiveReport('audit_logs')}
              className={cn(
                "px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5",
                activeReport === 'audit_logs' ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
              )}
            >
              <ShieldCheck size={12} /> Audit Logs
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
        {activeReport === 'search' ? (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter Tranx ID (Store Record ID) to search..."
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 text-lg font-medium"
              />
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
              Search across all purchases and sales using the unique ID from Store Keeper
            </p>
          </div>
        ) : (
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">From</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">To</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none" />
              </div>
            </div>
            {activeReport !== 'supplier_balances' && activeReport !== 'buyer_balances' && (
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Warehouse</label>
                <select value={selectedWarehouseId} onChange={e => setSelectedWarehouseId(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none">
                  <option value="ALL">All Warehouses</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        <AnimatePresence mode="wait">
          {activeReport === 'audit_logs' ? (
            <div key="audit-logs" className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">System Audit Trail</h2>
                <div className="text-[10px] font-bold text-slate-400 uppercase">
                  {auditLogs.length} Actions Tracked
                </div>
              </div>

              <div className="space-y-3">
                {auditLogs.length === 0 ? (
                  <div className="bg-white rounded-2xl p-12 border border-dashed border-slate-300 text-center">
                    <ShieldCheck className="mx-auto text-slate-200 mb-4" size={48} />
                    <p className="text-slate-400 font-medium">No audit logs found</p>
                  </div>
                ) : (
                  auditLogs.map((log) => (
                    <div key={log.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-300 transition-colors">
                      <div className="flex justify-between items-start">
                        <div className="flex gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                            log.action === 'CREATE' ? "bg-emerald-50 text-emerald-600" :
                            log.action === 'UPDATE' ? "bg-amber-50 text-amber-600" :
                            "bg-rose-50 text-rose-600"
                          )}>
                            {log.action === 'CREATE' ? <Plus size={20} /> : 
                             log.action === 'UPDATE' ? <Edit2 size={20} /> : 
                             <Trash2 size={20} />}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900 leading-tight">{log.details}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                                {log.module}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {new Date(log.timestamp).toLocaleString('en-GB', { 
                                  day: '2-digit', 
                                  month: 'short', 
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-2">
                              <div className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-500">
                                {log.userEmail?.[0].toUpperCase()}
                              </div>
                              <p className="text-[10px] text-slate-500 font-medium">
                                {log.userEmail}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={cn(
                            "text-[8px] font-black uppercase px-2 py-1 rounded-lg",
                            log.action === 'CREATE' ? "bg-emerald-100 text-emerald-700" :
                            log.action === 'UPDATE' ? "bg-amber-100 text-amber-700" :
                            "bg-rose-100 text-rose-700"
                          )}>
                            {log.action}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : activeReport === 'search' ? (
            <div key="search-results" className="space-y-4">
              {searchQuery.trim() === '' ? (
                <div className="bg-white rounded-2xl p-12 border border-dashed border-slate-300 text-center">
                  <Search className="mx-auto text-slate-200 mb-4" size={48} />
                  <p className="text-slate-400 font-medium">Enter a Tranx ID above to find linked transactions</p>
                </div>
              ) : (
                <>
                  {transactions.filter(t => t.storeRecordId?.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 border border-dashed border-slate-300 text-center">
                      <FileText className="mx-auto text-slate-200 mb-4" size={48} />
                      <p className="text-slate-400 font-medium">No transactions found matching "{searchQuery}"</p>
                    </div>
                  ) : (
                    transactions
                      .filter(t => t.storeRecordId?.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map(t => (
                        <div key={t.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-300 transition-colors">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className={cn(
                                  "text-[10px] font-bold px-2 py-0.5 rounded uppercase",
                                  t.type === 'PURCHASE' ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                                )}>
                                  {t.type}
                                </span>
                                <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded uppercase">
                                  {t.commodity}
                                </span>
                                <span className="text-[10px] text-slate-400">{new Date(t.date).toLocaleString()}</span>
                              </div>
                              <h3 className="font-bold text-slate-900 text-lg">
                                {t.type === 'PURCHASE' 
                                  ? (suppliers.find(s => s.id === t.supplierId)?.name || 'Unknown Supplier')
                                  : (buyers.find(b => b.id === t.buyerId)?.name || t.buyerName || 'Unknown Customer')
                                }
                              </h3>
                              <p className="text-xs text-slate-500 font-medium">Ref: {t.referenceId}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-black text-slate-900">₦{(t.totalValue || 0).toLocaleString()}</p>
                              <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Tranx ID: {t.storeRecordId}</p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-4 gap-2 pt-4 border-t border-slate-50">
                            <div className="text-center">
                              <p className="text-[9px] text-slate-400 font-bold uppercase">Gross</p>
                              <p className="text-sm font-bold">{t.grossWeight}kg</p>
                            </div>
                            <div className="text-center">
                              <p className="text-[9px] text-slate-400 font-bold uppercase">Net</p>
                              <p className="text-sm font-bold text-emerald-600">{t.netWeight}kg</p>
                            </div>
                            <div className="text-center">
                              <p className="text-[9px] text-slate-400 font-bold uppercase">Bags</p>
                              <p className="text-sm font-bold">{t.noOfBags || t.bags || '-'}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-[9px] text-slate-400 font-bold uppercase">Warehouse</p>
                              <p className="text-sm font-bold truncate">
                                {warehouses.find(w => w.id === t.warehouseId)?.name || t.warehouse || 'Main'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                  )}
                </>
              )}
            </div>
          ) : activeReport === 'supplier_balances' ? (
            <div key="balances" className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-indigo-600 rounded-2xl p-4 text-white shadow-lg">
                  <p className="text-[10px] font-bold uppercase opacity-60 mb-1">Total Credit (We Owe)</p>
                  <h2 className="text-xl font-black">₦{totalCreditBalance.toLocaleString()}</h2>
                </div>
                <div className="bg-rose-600 rounded-2xl p-4 text-white shadow-lg">
                  <p className="text-[10px] font-bold uppercase opacity-60 mb-1">Total Debit (They Owe)</p>
                  <h2 className="text-xl font-black">₦{totalDebitBalance.toLocaleString()}</h2>
                </div>
              </div>

              <section>
                <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowUpRight size={14} /> Credit Balances (We Owe)
                  </div>
                  <span className="bg-indigo-100 px-2 py-0.5 rounded text-[9px]">{creditSuppliers.length} Suppliers</span>
                </h3>
                <div className="space-y-2">
                  {creditSuppliers.length === 0 ? (
                    <p className="text-center py-8 text-slate-400 text-xs bg-white rounded-2xl border border-dashed border-slate-200">No credit balances</p>
                  ) : (
                    creditSuppliers.map(s => (
                      <div key={s.id} className="bg-white p-4 rounded-2xl border border-slate-200 flex justify-between items-center shadow-sm">
                        <div>
                          <p className="font-bold text-slate-900">{s.name}</p>
                          <p className="text-[10px] text-slate-400 uppercase">{s.location}</p>
                        </div>
                        <p className="text-lg font-black text-indigo-600">₦{s.balance.toLocaleString()}</p>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section>
                <h3 className="text-xs font-bold text-rose-600 uppercase tracking-widest mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowDownRight size={14} /> Debit Balances (They Owe Us)
                  </div>
                  <span className="bg-rose-100 px-2 py-0.5 rounded text-[9px]">{debitSuppliers.length} Suppliers</span>
                </h3>
                <div className="space-y-2">
                  {debitSuppliers.length === 0 ? (
                    <p className="text-center py-8 text-slate-400 text-xs bg-white rounded-2xl border border-dashed border-slate-200">No debit balances</p>
                  ) : (
                    debitSuppliers.map(s => (
                      <div key={s.id} className="bg-white p-4 rounded-2xl border border-slate-200 flex justify-between items-center shadow-sm">
                        <div>
                          <p className="font-bold text-slate-900">{s.name}</p>
                          <p className="text-[10px] text-slate-400 uppercase">{s.location}</p>
                        </div>
                        <p className="text-lg font-black text-rose-600">₦{Math.abs(s.balance).toLocaleString()}</p>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          ) : activeReport === 'buyer_balances' ? (
            <div key="buyer-balances" className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-600 rounded-2xl p-4 text-white shadow-lg">
                  <p className="text-[10px] font-bold uppercase opacity-60 mb-1">Total Debit (They Owe)</p>
                  <h2 className="text-xl font-black">₦{totalBuyerDebit.toLocaleString()}</h2>
                </div>
                <div className="bg-emerald-600 rounded-2xl p-4 text-white shadow-lg">
                  <p className="text-[10px] font-bold uppercase opacity-60 mb-1">Total Credit (We Owe)</p>
                  <h2 className="text-xl font-black">₦{totalBuyerCredit.toLocaleString()}</h2>
                </div>
              </div>

              <section>
                <h3 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowUpRight size={14} /> Debit Balances (They Owe Us)
                  </div>
                  <span className="bg-blue-100 px-2 py-0.5 rounded text-[9px]">{debitBuyers.length} Customers</span>
                </h3>
                <div className="space-y-2">
                  {debitBuyers.length === 0 ? (
                    <p className="text-center py-8 text-slate-400 text-xs bg-white rounded-2xl border border-dashed border-slate-200">No debit balances</p>
                  ) : (
                    debitBuyers.map(b => (
                      <div key={b.id} className="bg-white p-4 rounded-2xl border border-slate-200 flex justify-between items-center shadow-sm">
                        <div>
                          <p className="font-bold text-slate-900">{b.name}</p>
                          <p className="text-[10px] text-slate-400 uppercase">{b.location}</p>
                        </div>
                        <p className="text-lg font-black text-blue-600">₦{b.balance.toLocaleString()}</p>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section>
                <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowDownRight size={14} /> Credit Balances (We Owe Them)
                  </div>
                  <span className="bg-emerald-100 px-2 py-0.5 rounded text-[9px]">{creditBuyers.length} Customers</span>
                </h3>
                <div className="space-y-2">
                  {creditBuyers.length === 0 ? (
                    <p className="text-center py-8 text-slate-400 text-xs bg-white rounded-2xl border border-dashed border-slate-200">No credit balances</p>
                  ) : (
                    creditBuyers.map(b => (
                      <div key={b.id} className="bg-white p-4 rounded-2xl border border-slate-200 flex justify-between items-center shadow-sm">
                        <div>
                          <p className="font-bold text-slate-900">{b.name}</p>
                          <p className="text-[10px] text-slate-400 uppercase">{b.location}</p>
                        </div>
                        <p className="text-lg font-black text-emerald-600">₦{Math.abs(b.balance).toLocaleString()}</p>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          ) : activeReport === 'packaging_inventory' ? (
            <div key="packaging" className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-amber-600 rounded-2xl p-4 text-white shadow-lg">
                  <p className="text-[10px] font-bold uppercase opacity-60 mb-1">Jute Bags</p>
                  <h2 className="text-xl font-black">{packagingInventory['JUTE_BAG']?.toLocaleString() || 0} pcs</h2>
                </div>
                <div className="bg-slate-600 rounded-2xl p-4 text-white shadow-lg">
                  <p className="text-[10px] font-bold uppercase opacity-60 mb-1">Nylon Bags</p>
                  <h2 className="text-xl font-black">{packagingInventory['NYLON_BAG']?.toLocaleString() || 0} pcs</h2>
                </div>
              </div>

              <section className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Recent Bag Transactions</h3>
                <div className="space-y-2">
                  {bagTransactions.filter(tx => {
                    const date = tx.date.split('T')[0];
                    return date >= startDate && date <= endDate && (selectedWarehouseId === 'ALL' || tx.warehouseId === selectedWarehouseId);
                  }).map(tx => (
                    <div key={tx.id} className="bg-white p-4 rounded-2xl border border-slate-200 flex justify-between items-center shadow-sm">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn(
                            "text-[8px] font-bold px-1.5 py-0.5 rounded uppercase",
                            tx.type === 'STOCK_IN' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                          )}>
                            {tx.type?.replace('_', ' ') || 'N/A'}
                          </span>
                          <span className="text-[8px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded uppercase">
                            {tx.packagingType?.replace('_', ' ') || 'N/A'}
                          </span>
                        </div>
                        <p className="font-bold text-slate-900 text-sm">{tx.reference}</p>
                        <p className="text-[10px] text-slate-400">{new Date(tx.date).toLocaleDateString()}</p>
                      </div>
                      <p className={cn(
                        "text-lg font-black",
                        tx.type === 'STOCK_IN' ? "text-emerald-600" : "text-amber-600"
                      )}>
                        {tx.type === 'STOCK_IN' ? '+' : '-'}{tx.quantity}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : activeReport === 'transfers' ? (
            <div key="transfers" className="space-y-4">
              <div className="bg-indigo-600 rounded-2xl p-4 text-white shadow-lg flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-bold uppercase opacity-60">Total Transfers</p>
                  <h2 className="text-2xl font-black">{filteredTransfers.length}</h2>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase opacity-60">Period</p>
                  <h2 className="text-sm font-bold">{startDate} to {endDate}</h2>
                </div>
              </div>

              <div className="space-y-2">
                {filteredTransfers.length === 0 ? (
                  <p className="text-center py-12 text-slate-400 text-xs bg-white rounded-2xl border border-dashed border-slate-200">No transfers found for this period</p>
                ) : (
                  filteredTransfers.map((t) => (
                    <div key={t.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn(
                              "text-[8px] font-bold px-1.5 py-0.5 rounded uppercase",
                              t.transferType === 'COMMODITY' ? "bg-indigo-100 text-indigo-700" : "bg-amber-100 text-amber-700"
                            )}>
                              {t.transferType}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">{new Date(t.date).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center gap-3 text-slate-900 font-bold">
                            <span className="text-sm">{warehouses.find(w => w.id === t.sourceWarehouseId)?.name || 'Unknown'}</span>
                            <ArrowRightLeft size={14} className="text-slate-300" />
                            <span className="text-sm">{warehouses.find(w => w.id === t.destinationWarehouseId)?.name || 'Unknown'}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wider">
                            {t.transferType === 'COMMODITY' ? (t as Transaction).commodity : (t as BagTransaction).packagingType.replace('_', ' ')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black text-slate-900">
                            {t.transferType === 'COMMODITY' ? `${(t as Transaction).netWeight.toLocaleString()}kg` : `${(t as BagTransaction).quantity.toLocaleString()} units`}
                          </p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{(t as any).reference || (t as any).referenceId}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div key="operational" className="space-y-3">
              <div className="bg-indigo-600 rounded-2xl p-4 text-white shadow-lg flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-bold uppercase opacity-60">Total {activeReport === 'operational_purchases' ? 'Purchases' : 'Sales'}</p>
                  <h2 className="text-2xl font-black">₦{filteredOperationalTx.reduce((sum, t) => sum + (t.totalValue || 0), 0).toLocaleString()}</h2>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase opacity-60">Total Weight</p>
                  <h2 className="text-2xl font-black">{filteredOperationalTx.reduce((sum, t) => sum + t.netWeight, 0).toLocaleString()}kg</h2>
                </div>
              </div>

              {filteredOperationalTx.map(t => (
                <div key={t.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">
                        {t.commodity} | {warehouses.find(w => w.id === t.warehouseId)?.name || t.warehouse || 'Main'}
                      </p>
                      <h3 className="font-bold text-slate-900">{t.referenceId}</h3>
                      <p className="text-[10px] text-slate-400">{new Date(t.date).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-slate-900">₦{(t.totalValue || 0).toLocaleString()}</p>
                      <div className="flex flex-wrap gap-1.5 text-[8px] font-bold uppercase tracking-tighter justify-end">
                        <span className="text-blue-600">Bags: {t.noOfBags || t.bags || '-'}</span>
                        <span className="text-slate-500">G: {t.grossWeight}kg</span>
                        <span className="text-rose-500">D: {(t.grossWeight - t.netWeight).toFixed(2)}kg</span>
                        <span className="text-emerald-600">N: {t.netWeight}kg</span>
                        <span className="text-amber-600">Price: ₦{t.pricePerKg?.toLocaleString() || '-'}</span>
                      </div>
                      {t.deductions && (
                        <div className="mt-1 flex flex-wrap gap-1.5 text-[7px] font-bold uppercase tracking-tighter justify-end text-slate-400">
                          {((t.deductions.moistureActual - t.deductions.moistureBenchmark) * (t.grossWeight || 0) / 100) > 0 && (
                            <span>Moisture: {(((t.deductions.moistureActual - t.deductions.moistureBenchmark) * (t.grossWeight || 0)) / 100).toFixed(2)}kg</span>
                          )}
                          {t.deductions.tareWeight > 0 && <span>Tare: {t.deductions.tareWeight}kg</span>}
                          {t.deductions.moldWeight > 0 && <span>Mold: {t.deductions.moldWeight}kg</span>}
                          {t.deductions.otherDeduction > 0 && <span>Other: {t.deductions.otherDeduction}kg</span>}
                        </div>
                      )}
                    </div>
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
