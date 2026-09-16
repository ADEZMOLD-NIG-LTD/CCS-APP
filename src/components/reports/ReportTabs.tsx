/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Search, ShieldCheck } from 'lucide-react';
import type { AppModuleKey, PermissionAction } from '../../lib/permissions';
import { cn } from '../../lib/utils';

export type ReportType =
  | 'supplier_balances' | 'buyer_balances' | 'operational_purchases' | 'operational_sales' | 'packaging_inventory'
  | 'transfers' | 'search' | 'audit_logs' | 'journal' | 'attendance' | 'payroll';

export interface ReportTab {
  id: ReportType;
  label: string;
  permission: PermissionAction;
  /** Company module that must be enabled for this report's data to be readable. */
  module?: AppModuleKey;
}

export const REPORT_TABS: ReportTab[] = [
  { id: 'supplier_balances', label: 'Supplier balances', permission: 'view_reports' },
  { id: 'buyer_balances', label: 'Customer balances', permission: 'view_reports' },
  { id: 'operational_purchases', label: 'Purchases', permission: 'view_reports' },
  { id: 'operational_sales', label: 'Sales', permission: 'view_reports' },
  { id: 'journal', label: 'Cash book', permission: 'view_journal' },
  { id: 'packaging_inventory', label: 'Packaging', permission: 'view_reports' },
  { id: 'transfers', label: 'Transfers', permission: 'view_reports' },
  { id: 'attendance', label: 'Attendance', permission: 'view_staff', module: 'staff' },
  { id: 'payroll', label: 'Payroll', permission: 'view_payroll', module: 'staff' },
  { id: 'search', label: 'Search Tranx ID', permission: 'view_reports' },
  { id: 'audit_logs', label: 'Audit logs', permission: 'view_audit_logs' },
];

interface ReportTabsProps {
  tabs: ReportTab[];
  activeReport: ReportType;
  setActiveReport: (type: ReportType) => void;
}

export default function ReportTabs({ tabs, activeReport, setActiveReport }: ReportTabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar" role="tablist">
      {tabs.map(tab => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeReport === tab.id}
          onClick={() => setActiveReport(tab.id)}
          className={cn(
            'px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5',
            activeReport === tab.id ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          )}
        >
          {tab.id === 'search' && <Search size={12} />}
          {tab.id === 'audit_logs' && <ShieldCheck size={12} />}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
