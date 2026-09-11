/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Search, ShieldCheck } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type ReportType = 'supplier_balances' | 'buyer_balances' | 'operational_purchases' | 'operational_sales' | 'packaging_inventory' | 'transfers' | 'search' | 'audit_logs' | 'journal' | 'attendance' | 'payroll';

interface ReportTabsProps {
  activeReport: ReportType;
  setActiveReport: (type: ReportType) => void;
  userRole?: string;
}

export default function ReportTabs({ activeReport, setActiveReport, userRole }: ReportTabsProps) {
  const tabs: { id: ReportType; label: string; icon?: React.ReactNode; roles?: string[] }[] = [
    { id: 'supplier_balances', label: 'Supplier Balances' },
    { id: 'buyer_balances', label: 'Customer Balances' },
    { id: 'operational_purchases', label: 'Purchases' },
    { id: 'operational_sales', label: 'Sales' },
    { id: 'journal', label: 'Journal (In/Out)' },
    { id: 'packaging_inventory', label: 'Packaging' },
    { id: 'transfers', label: 'Transfers' },
    { id: 'attendance', label: 'Attendance', roles: ['ADMIN', 'MANAGER', 'HR'] },
    { id: 'payroll', label: 'Payroll', roles: ['ADMIN', 'ACCOUNT', 'MANAGER'] },
    { id: 'search', label: 'Search Tranx ID', icon: <Search size={12} /> },
    { id: 'audit_logs', label: 'Audit Logs', icon: <ShieldCheck size={12} />, roles: ['ADMIN', 'AUDITOR', 'MANAGER'] },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
      {tabs.map((tab) => {
        if (tab.roles && !tab.roles.includes(userRole || '')) return null;
        
        return (
          <button
            key={tab.id}
            onClick={() => setActiveReport(tab.id)}
            className={cn(
              "px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5",
              activeReport === tab.id ? "bg-indigo-600 text-white shadow-md" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
