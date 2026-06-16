/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Download, 
  Search,
  ShieldCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Supplier, Transaction, Payment, JournalEntry, Warehouse, Buyer, BagTransaction, AuditLog } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { reportFirestoreError, OperationType } from '../lib/firestore';
import Toast from './Toast';

// Sub-components
import SupplierBalancesReport from './reports/SupplierBalancesReport';
import BuyerBalancesReport from './reports/BuyerBalancesReport';
import OperationalTransactionsReport from './reports/OperationalTransactionsReport';
import PackagingReport from './reports/PackagingReport';
import TransfersReport from './reports/TransfersReport';
import AuditLogsReport from './reports/AuditLogsReport';
import SearchReport from './reports/SearchReport';
import JournalReport from './reports/JournalReport';
import ReportTabs, { ReportType } from './reports/ReportTabs';
import ReportFilters from './reports/ReportFilters';

// Services
import { generatePDF } from '../services/reportService';

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
  const [selectedCommodity, setSelectedCommodity] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Load Data from Firestore
  useEffect(() => {
    if (!profile?.companyId) return;

    const qSuppliers = query(
      collection(db, 'suppliers'), 
      where('companyId', '==', profile.companyId)
    );
    const unsubscribeSuppliers = onSnapshot(qSuppliers, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Supplier));
      const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
      setSuppliers(sorted);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'suppliers')));

    const qBuyers = query(
      collection(db, 'buyers'), 
      where('companyId', '==', profile.companyId)
    );
    const unsubscribeBuyers = onSnapshot(qBuyers, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Buyer));
      const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
      setBuyers(sorted);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'buyers')));

    const qWarehouses = query(
      collection(db, 'warehouses'), 
      where('companyId', '==', profile.companyId)
    );
    const unsubscribeWarehouses = onSnapshot(qWarehouses, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Warehouse));
      const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
      setWarehouses(sorted);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'warehouses')));

    const qTx = query(
      collection(db, 'transactions'), 
      where('companyId', '==', profile.companyId)
    );
    const unsubscribeTx = onSnapshot(qTx, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Transaction));
      const sorted = data.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      setTransactions(sorted);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'transactions')));

    const qPayments = query(
      collection(db, 'payments'), 
      where('companyId', '==', profile.companyId)
    );
    const unsubscribePayments = onSnapshot(qPayments, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Payment));
      const sorted = data.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      setPayments(sorted);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'payments')));

    let unsubscribeAuditLogs = () => {};
    if (profile.role === 'ADMIN' || profile.role === 'MANAGER' || profile.role === 'AUDITOR') {
      const qAuditLogs = query(
        collection(db, 'audit_logs'),
        where('companyId', '==', profile.companyId)
      );
      unsubscribeAuditLogs = onSnapshot(qAuditLogs, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AuditLog));
        const sorted = data.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
        setAuditLogs(sorted);
      }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'audit_logs')));
    }

    const qJournal = query(
      collection(db, 'journal'), 
      where('companyId', '==', profile.companyId)
    );
    const unsubscribeJournal = onSnapshot(qJournal, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as JournalEntry));
      const sorted = data.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      setJournal(sorted);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'journal')));

    const qBags = query(
      collection(db, 'bag_transactions'), 
      where('companyId', '==', profile.companyId)
    );
    const unsubscribeBags = onSnapshot(qBags, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as BagTransaction));
      const sorted = data.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      setBagTransactions(sorted);
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
    const activeTransactions = transactions.filter(t => !t.isDeleted);
    const activePayments = payments.filter(p => !p.isDeleted);
    const activeJournal = journal.filter(e => !e.isDeleted);

    return suppliers.map(s => {
      const sPurchases = activeTransactions.filter(t => 
        t.supplierId === s.id && 
        t.type === 'PURCHASE' && 
        t.date.split('T')[0] <= endDate &&
        (selectedWarehouseId === 'ALL' || t.warehouseId === selectedWarehouseId)
      );
      const sReturns = activeTransactions.filter(t => 
        t.supplierId === s.id && 
        (t.type as string) === 'PURCHASE_RETURN' && 
        t.date.split('T')[0] <= endDate &&
        (selectedWarehouseId === 'ALL' || t.warehouseId === selectedWarehouseId)
      );
      const sSales = activeTransactions.filter(t => 
        t.supplierId === s.id && 
        t.type === 'SALE' && 
        t.date.split('T')[0] <= endDate &&
        (selectedWarehouseId === 'ALL' || t.warehouseId === selectedWarehouseId)
      );
      const sPay = activePayments.filter(p => 
        p.supplierId === s.id && 
        p.date.split('T')[0] <= endDate &&
        (selectedWarehouseId === 'ALL' || p.warehouseId === selectedWarehouseId)
      );
      const sExp = activeJournal.filter(e => 
        e.supplierId === s.id && 
        e.date.split('T')[0] <= endDate &&
        (selectedWarehouseId === 'ALL' || e.warehouseId === selectedWarehouseId)
      );
      
      const totalPurchases = sPurchases.reduce((sum, t) => sum + (Number(t.totalValue) || 0), 0);
      const totalReturns = sReturns.reduce((sum, t) => sum + (Number(t.totalValue) || 0), 0);
      const totalSales = sSales.reduce((sum, t) => sum + (Number(t.totalValue) || 0), 0);
      const totalPayments = sPay.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const totalCharges = sExp.reduce((sum, e) => sum + (e.type === 'OUTFLOW' ? Number(e.amount) || 0 : -Number(e.amount) || 0), 0);
      
      const baseBalance = selectedWarehouseId === 'ALL' ? (Number(s.previousBalance) || 0) : 0;
      const balance = baseBalance + totalPurchases - totalReturns - totalSales - totalPayments - totalCharges;
      return { ...s, balance };
    }).filter(s => s.balance !== 0);
  }, [suppliers, transactions, payments, journal, endDate, selectedWarehouseId]);

  const creditSuppliers = supplierBalances.filter(s => s.balance > 0);
  const debitSuppliers = supplierBalances.filter(s => s.balance < 0);

  const totalCreditBalance = useMemo(() => creditSuppliers.reduce((sum, s) => sum + s.balance, 0), [creditSuppliers]);
  const totalDebitBalance = useMemo(() => debitSuppliers.reduce((sum, s) => sum + Math.abs(s.balance), 0), [debitSuppliers]);

  // Buyer Balances Report Logic
  const buyerBalances = useMemo(() => {
    const activeTransactions = transactions.filter(t => !t.isDeleted);
    const activeJournal = journal.filter(e => !e.isDeleted);

    return buyers.map(b => {
      const bSales = activeTransactions.filter(t => 
        t.buyerId === b.id && 
        t.type === 'SALE' && 
        t.date.split('T')[0] <= endDate &&
        (selectedWarehouseId === 'ALL' || t.warehouseId === selectedWarehouseId)
      );
      const bReturns = activeTransactions.filter(t => 
        t.buyerId === b.id && 
        (t.type as string) === 'SALES_RETURN' && 
        t.date.split('T')[0] <= endDate &&
        (selectedWarehouseId === 'ALL' || t.warehouseId === selectedWarehouseId)
      );
      const bPayments = activeJournal.filter(e => 
        e.buyerId === b.id && 
        e.type === 'INFLOW' && 
        e.date.split('T')[0] <= endDate &&
        (selectedWarehouseId === 'ALL' || e.warehouseId === selectedWarehouseId)
      );
      const bCharges = activeJournal.filter(e => 
        e.buyerId === b.id && 
        e.type === 'OUTFLOW' && 
        e.date.split('T')[0] <= endDate &&
        (selectedWarehouseId === 'ALL' || e.warehouseId === selectedWarehouseId)
      );
      
      const totalSales = bSales.reduce((sum, t) => sum + (Number(t.totalValue) || 0), 0);
      const totalReturns = bReturns.reduce((sum, t) => sum + (Number(t.totalValue) || 0), 0);
      const totalPayments = bPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const totalCharges = bCharges.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
      
      const baseBalance = selectedWarehouseId === 'ALL' ? (Number(b.previousBalance) || 0) : 0;
      const balance = baseBalance + totalSales - totalReturns + totalCharges - totalPayments;
      return { ...b, balance };
    }).filter(b => b.balance !== 0);
  }, [buyers, transactions, journal, endDate, selectedWarehouseId]);

  const debitBuyers = buyerBalances.filter(b => b.balance > 0);
  const creditBuyers = buyerBalances.filter(b => b.balance < 0);

  const totalBuyerDebit = useMemo(() => debitBuyers.reduce((sum, b) => sum + b.balance, 0), [debitBuyers]);
  const totalBuyerCredit = useMemo(() => creditBuyers.reduce((sum, b) => sum + Math.abs(b.balance), 0), [creditBuyers]);

  // Packaging Inventory Logic
  const packagingInventory = useMemo(() => {
    const summary: Record<string, number> = {
      'JUTE_BAG': 0,
      'NYLON_BAG': 0
    };

    bagTransactions.filter(tx => !tx.isDeleted).forEach(tx => {
      const date = tx.date.split('T')[0];
      if (date > endDate) return;

      if (tx.type === 'TRANSFER') {
        if (selectedWarehouseId === 'ALL') return;
        if (tx.sourceWarehouseId === selectedWarehouseId) summary[tx.packagingType] -= Number(tx.quantity) || 0;
        if (tx.destinationWarehouseId === selectedWarehouseId) summary[tx.packagingType] += Number(tx.quantity) || 0;
      } else {
        if (selectedWarehouseId !== 'ALL' && tx.warehouseId !== selectedWarehouseId) return;
        if (tx.type === 'STOCK_IN' || tx.type === 'RETURN') summary[tx.packagingType] += Number(tx.quantity) || 0;
        if (tx.type === 'ISSUE') summary[tx.packagingType] -= Number(tx.quantity) || 0;
      }
    });

    return summary;
  }, [bagTransactions, endDate, selectedWarehouseId]);

  // Operational Reports Logic
  const filteredOperationalTx = useMemo(() => {
    return transactions.filter(t => {
      if (t.isDeleted) return false;
      const date = new Date(t.date).toISOString().split('T')[0];
      const dateMatch = date >= startDate && date <= endDate;
      const warehouseMatch = selectedWarehouseId === 'ALL' || t.warehouseId === selectedWarehouseId;
      const commodityMatch = selectedCommodity === 'ALL' || t.commodity === selectedCommodity;
      const typeMatch = activeReport === 'operational_purchases' ? t.type === 'PURCHASE' : t.type === 'SALE';
      return dateMatch && warehouseMatch && commodityMatch && typeMatch;
    });
  }, [transactions, startDate, endDate, selectedWarehouseId, selectedCommodity, activeReport]);

  const filteredTransfers = useMemo(() => {
    const commodityTransfers = transactions.filter(t => {
      if (t.type !== 'TRANSFER' || t.isDeleted) return false;
      const date = new Date(t.date).toISOString().split('T')[0];
      const dateMatch = date >= startDate && date <= endDate;
      const commodityMatch = selectedCommodity === 'ALL' || t.commodity === selectedCommodity;
      const warehouseMatch = selectedWarehouseId === 'ALL' || 
                             t.sourceWarehouseId === selectedWarehouseId || 
                             t.destinationWarehouseId === selectedWarehouseId;
      return dateMatch && warehouseMatch && commodityMatch;
    }).map(t => ({
      ...t,
      transferType: 'COMMODITY' as const
    }));

    const bagTransfers = bagTransactions.filter(t => {
      if (t.type !== 'TRANSFER' || t.isDeleted) return false;
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

  const filteredJournal = useMemo(() => {
    return journal.filter(e => {
      if (e.isDeleted) return false;
      if ((e as any).excludeFromJournal) return false;
      const date = e.date.split('T')[0];
      const dateMatch = date >= startDate && date <= endDate;
      const warehouseMatch = selectedWarehouseId === 'ALL' || e.warehouseId === selectedWarehouseId;
      return dateMatch && warehouseMatch;
    });
  }, [journal, startDate, endDate, selectedWarehouseId]);

  const handleExportPDF = () => {
    generatePDF({
      activeReport,
      startDate,
      endDate,
      selectedWarehouseId,
      searchQuery,
      company,
      warehouses,
      suppliers,
      buyers,
      transactions,
      creditSuppliers,
      debitSuppliers,
      totalCreditBalance,
      totalDebitBalance,
      debitBuyers,
      creditBuyers,
      totalBuyerDebit,
      totalBuyerCredit,
      packagingInventory,
      filteredOperationalTx,
      filteredTransfers,
      selectedCommodity,
      filteredJournal
    });
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
            onClick={handleExportPDF}
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-sm font-bold active:scale-95 transition-all hover:bg-indigo-700"
          >
            <Download size={18} /> Export PDF
          </button>
        </div>

        <ReportTabs 
          activeReport={activeReport} 
          setActiveReport={setActiveReport} 
          userRole={profile?.role} 
        />
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
        {activeReport !== 'search' && (
          <ReportFilters
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            selectedWarehouseId={selectedWarehouseId}
            setSelectedWarehouseId={setSelectedWarehouseId}
            selectedCommodity={selectedCommodity}
            setSelectedCommodity={setSelectedCommodity}
            warehouses={warehouses}
            activeReport={activeReport}
          />
        )}

        <AnimatePresence mode="wait">
          {activeReport === 'audit_logs' ? (
            <AuditLogsReport key="audit-logs" auditLogs={auditLogs} />
          ) : activeReport === 'search' ? (
            <SearchReport
              key="search-report"
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              transactions={transactions}
              suppliers={suppliers}
              buyers={buyers}
              warehouses={warehouses}
            />
          ) : activeReport === 'supplier_balances' ? (
            <SupplierBalancesReport
              key="supplier-balances"
              totalCreditBalance={totalCreditBalance}
              totalDebitBalance={totalDebitBalance}
              creditSuppliers={creditSuppliers}
              debitSuppliers={debitSuppliers}
            />
          ) : activeReport === 'buyer_balances' ? (
            <BuyerBalancesReport
              key="buyer-balances"
              totalBuyerDebit={totalBuyerDebit}
              totalBuyerCredit={totalBuyerCredit}
              debitBuyers={debitBuyers}
              creditBuyers={creditBuyers}
            />
          ) : activeReport === 'packaging_inventory' ? (
            <PackagingReport
              key="packaging-report"
              packagingInventory={packagingInventory}
              bagTransactions={bagTransactions}
              startDate={startDate}
              endDate={endDate}
              selectedWarehouseId={selectedWarehouseId}
            />
          ) : activeReport === 'transfers' ? (
            <TransfersReport
              key="transfers-report"
              filteredTransfers={filteredTransfers}
              warehouses={warehouses}
              startDate={startDate}
              endDate={endDate}
            />
          ) : activeReport === 'journal' ? (
            <JournalReport
              key="journal-report"
              journal={filteredJournal}
              warehouses={warehouses}
              startDate={startDate}
              endDate={endDate}
            />
          ) : (
            <OperationalTransactionsReport
              key="operational-report"
              type={activeReport === 'operational_purchases' ? 'PURCHASES' : 'SALES'}
              filteredOperationalTx={filteredOperationalTx}
              warehouses={warehouses}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
