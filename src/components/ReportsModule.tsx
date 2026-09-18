/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useActiveCollection, useCompanyCollection, useDerivedLevels, useWarehouses } from '../contexts/CompanyDataContext';
import { buildCashMovements, computeBuyerBalances, computeStockLevels, computeSupplierBalances, levelsByItem } from '../lib/finance';
import { daysAgoLocal, isoToLocalDate, todayLocal } from '../lib/dates';
import { attendanceSummary, buildReconciliation, generatePDF, payrollInPeriod, searchTransactions, type TransferRow } from '../services/reportService';
import type { Buyer, Supplier } from '../types';
import AttendanceReport from './reports/AttendanceReport';
import AuditLogsReport from './reports/AuditLogsReport';
import BuyerBalancesReport from './reports/BuyerBalancesReport';
import JournalReport from './reports/JournalReport';
import OperationalTransactionsReport from './reports/OperationalTransactionsReport';
import PackagingReport from './reports/PackagingReport';
import PayrollReport from './reports/PayrollReport';
import ReconciliationReport from './reports/ReconciliationReport';
import ReportFilters from './reports/ReportFilters';
import ReportTabs, { REPORT_TABS, type ReportType } from './reports/ReportTabs';
import SearchReport from './reports/SearchReport';
import SupplierBalancesReport from './reports/SupplierBalancesReport';
import TransfersReport from './reports/TransfersReport';

const byDateDesc = (a: { date: string }, b: { date: string }) => new Date(b.date).getTime() - new Date(a.date).getTime();
const absSum = (rows: { balance: number }[]) => rows.reduce((s, r) => s + Math.abs(r.balance), 0);

export default function ReportsModule() {
  const { company, profile, can, isModuleEnabled } = useAuth();
  const tabs = useMemo(() => REPORT_TABS.filter(t => can(t.permission) && (!t.module || isModuleEnabled(t.module))), [can, isModuleEnabled]);
  const available = useMemo(() => new Set(tabs.map(t => t.id)), [tabs]);

  const [selected, setSelected] = useState<ReportType>('supplier_balances');
  const report: ReportType | undefined = available.has(selected) ? selected : tabs[0]?.id;
  const [startDate, setStartDate] = useState(daysAgoLocal(30));
  const [endDate, setEndDate] = useState(todayLocal());
  const [warehouseId, setWarehouseId] = useState('ALL');
  const [commodity, setCommodity] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const suppliers = useActiveCollection('suppliers').data;
  const buyers = useActiveCollection('buyers').data;
  const transactions = useActiveCollection('transactions').data;
  const payments = useActiveCollection('payments').data;
  const journal = useActiveCollection('journal').data;
  const bagTransactions = useActiveCollection('bag_transactions').data;
  const { data: warehouses } = useWarehouses();
  const staff = useCompanyCollection('staff', available.has('attendance') || available.has('payroll')).data;
  const attendance = useCompanyCollection('attendance', available.has('attendance')).data;
  const payrolls = useCompanyCollection('payrolls', available.has('payroll')).data;

  const period = useMemo(() => {
    const test = (iso: string) => {
      const day = isoToLocalDate(iso);
      return !!day && day >= startDate && day <= endDate;
    };
    return { test };
  }, [startDate, endDate]);
  const inWarehouse = (id?: string) => warehouseId === 'ALL' || id === warehouseId;

  const supplierBalances = useMemo(() => {
    const balances = computeSupplierBalances(suppliers, { transactions, payments, journal }, { asOf: endDate, warehouseId });
    return suppliers
      .map((s): Supplier & { balance: number } => ({ ...s, balance: balances.get(s.id) ?? 0 }))
      .filter(s => Math.abs(s.balance) >= 0.01)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [suppliers, transactions, payments, journal, endDate, warehouseId]);

  const buyerBalances = useMemo(() => {
    const balances = computeBuyerBalances(buyers, { transactions, journal }, { asOf: endDate, warehouseId });
    return buyers
      .map((b): Buyer & { balance: number } => ({ ...b, balance: balances.get(b.id) ?? 0 }))
      .filter(b => Math.abs(b.balance) >= 0.01)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [buyers, transactions, journal, endDate, warehouseId]);

  const bagLevels = useMemo(() => {
    const upToEnd = bagTransactions.filter(b => {
      const day = isoToLocalDate(b.date);
      return !!day && day <= endDate;
    });
    return levelsByItem(computeStockLevels({ bagTransactions: upToEnd }), 'BAG', warehouseId);
  }, [bagTransactions, endDate, warehouseId]);

  const periodBags = useMemo(
    () => bagTransactions
      .filter(b => period.test(b.date) && (warehouseId === 'ALL' || [b.warehouseId, b.sourceWarehouseId, b.destinationWarehouseId].includes(warehouseId)))
      .sort(byDateDesc),
    [bagTransactions, period, warehouseId]
  );

  const operational = useMemo(() => {
    const types = report === 'operational_sales' ? ['SALE', 'SALES_RETURN'] : ['PURCHASE', 'PURCHASE_RETURN'];
    return transactions
      .filter(t => types.includes(t.type) && period.test(t.date) && inWarehouse(t.warehouseId) && (commodity === 'ALL' || t.commodity === commodity))
      .sort(byDateDesc);
  }, [transactions, report, period, warehouseId, commodity]);

  const transfers = useMemo<TransferRow[]>(() => {
    const touches = (t: { sourceWarehouseId?: string; destinationWarehouseId?: string }) =>
      warehouseId === 'ALL' || t.sourceWarehouseId === warehouseId || t.destinationWarehouseId === warehouseId;
    const commodityRows: TransferRow[] = transactions
      .filter(t => t.type === 'TRANSFER' && period.test(t.date) && touches(t) && (commodity === 'ALL' || t.commodity === commodity))
      .map(t => ({ ...t, transferType: 'COMMODITY' as const }));
    const bagRows: TransferRow[] = commodity === 'ALL'
      ? bagTransactions.filter(b => b.type === 'TRANSFER' && period.test(b.date) && touches(b)).map(b => ({ ...b, transferType: 'BAG' as const }))
      : [];
    return [...commodityRows, ...bagRows].sort(byDateDesc);
  }, [transactions, bagTransactions, period, warehouseId, commodity]);

  const movements = useMemo(
    () => buildCashMovements(journal)
      .filter(m => period.test(m.date) && inWarehouse(m.warehouseId))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || new Date(a.postingDate || a.date).getTime() - new Date(b.postingDate || b.date).getTime()),
    [journal, payments, period, warehouseId]
  );

  const searchResults = useMemo(() => searchTransactions(transactions, searchQuery).sort(byDateDesc), [transactions, searchQuery]);
  const attendanceRows = useMemo(() => attendanceSummary(attendance, staff, { start: startDate, end: endDate, warehouseId }), [attendance, staff, startDate, endDate, warehouseId]);
  const payrollRows = useMemo(() => payrollInPeriod(payrolls, startDate, endDate), [payrolls, startDate, endDate]);
  const commodities = useMemo(() => Array.from(new Set(['COCOA', 'CASHEW', 'PK', ...transactions.map(t => t.commodity).filter(Boolean)])).sort(), [transactions]);

  // Dual-control check: inventory ledger against the store keeper's register.
  const canReconcile = available.has('reconciliation');
  const { levels: stockLevels } = useDerivedLevels({ commodities: canReconcile, store: canReconcile });
  const reconciliationRows = useMemo(
    () => (canReconcile ? buildReconciliation(stockLevels, warehouses) : []),
    [canReconcile, stockLevels, warehouses]
  );

  if (!report || !profile?.companyId) {
    return <div className="p-8 text-center text-slate-500">You do not have access to any reports.</div>;
  }

  const creditSuppliers = supplierBalances.filter(s => s.balance > 0);
  const debitSuppliers = supplierBalances.filter(s => s.balance < 0);
  const debitBuyers = buyerBalances.filter(b => b.balance > 0);
  const creditBuyers = buyerBalances.filter(b => b.balance < 0);

  const exportPdf = () => {
    if (report === 'audit_logs') return;
    generatePDF({
      report,
      companyName: company?.name || '',
      startDate,
      endDate,
      warehouseLabel: warehouseId === 'ALL' ? 'All warehouses' : warehouses.find(w => w.id === warehouseId)?.name || 'Unknown',
      commodityLabel: commodity === 'ALL' ? 'All commodities' : commodity,
      warehouses,
      suppliers,
      buyers,
      staff,
      supplierBalances,
      buyerBalances,
      bagLevels,
      bagTransactions: periodBags,
      operational,
      transfers,
      movements,
      searchQuery,
      searchResults,
      attendance: attendanceRows,
      payrolls: payrollRows,
      reconciliation: reconciliationRows,
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4 gap-3">
          <h1 className="text-xl font-bold text-slate-900">Reports</h1>
          {report !== 'audit_logs' && (
            <button onClick={exportPdf} disabled={report === 'search' && searchResults.length === 0} className="bg-indigo-600 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-sm font-bold hover:bg-indigo-700 disabled:opacity-50">
              <Download size={18} /> Export PDF
            </button>
          )}
        </div>
        <ReportTabs tabs={tabs} activeReport={report} setActiveReport={setSelected} />
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
        {report !== 'search' && report !== 'audit_logs' && (
          <ReportFilters
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            selectedWarehouseId={warehouseId}
            setSelectedWarehouseId={setWarehouseId}
            selectedCommodity={commodity}
            setSelectedCommodity={setCommodity}
            warehouses={warehouses}
            commodities={commodities}
            activeReport={report}
          />
        )}

        <AnimatePresence mode="wait">
          {report === 'audit_logs' ? (
            <AuditLogsReport key="audit" companyId={profile.companyId} />
          ) : report === 'search' ? (
            <SearchReport key="search" searchQuery={searchQuery} onSearchChange={setSearchQuery} results={searchResults} suppliers={suppliers} buyers={buyers} warehouses={warehouses} />
          ) : report === 'supplier_balances' ? (
            <SupplierBalancesReport key="suppliers" totalCreditBalance={absSum(creditSuppliers)} totalDebitBalance={absSum(debitSuppliers)} creditSuppliers={creditSuppliers} debitSuppliers={debitSuppliers} />
          ) : report === 'buyer_balances' ? (
            <BuyerBalancesReport key="buyers" totalBuyerDebit={absSum(debitBuyers)} totalBuyerCredit={absSum(creditBuyers)} debitBuyers={debitBuyers} creditBuyers={creditBuyers} />
          ) : report === 'packaging_inventory' ? (
            <PackagingReport key="packaging" bagLevels={bagLevels} bagTransactions={periodBags} warehouses={warehouses} suppliers={suppliers} selectedWarehouseId={warehouseId} endDate={endDate} />
          ) : report === 'reconciliation' ? (
            <ReconciliationReport key="reconciliation" rows={reconciliationRows} asAt={todayLocal()} />
          ) : report === 'transfers' ? (
            <TransfersReport key="transfers" filteredTransfers={transfers} warehouses={warehouses} startDate={startDate} endDate={endDate} />
          ) : report === 'attendance' ? (
            <AttendanceReport key="attendance" rows={attendanceRows} startDate={startDate} endDate={endDate} />
          ) : report === 'payroll' ? (
            <PayrollReport key="payroll" payrolls={payrollRows} staffList={staff} startDate={startDate} endDate={endDate} />
          ) : report === 'journal' ? (
            <JournalReport key="journal" movements={movements} warehouses={warehouses} />
          ) : (
            <OperationalTransactionsReport key={report} type={report === 'operational_purchases' ? 'PURCHASES' : 'SALES'} transactions={operational} warehouses={warehouses} suppliers={suppliers} buyers={buyers} />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
