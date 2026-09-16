/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { Payroll, Staff } from '../../types';
import { cn, formatCurrency, roundTo } from '../../lib/utils';

interface PayrollReportProps {
  /** Payroll rows already restricted to the selected months. */
  payrolls: Payroll[];
  staffList: Staff[];
  startDate: string;
  endDate: string;
}

export default function PayrollReport({ payrolls, staffList, startDate, endDate }: PayrollReportProps) {
  const total = (key: 'grossIncome' | 'pension' | 'paye' | 'otherDeductions' | 'netPay') => roundTo(payrolls.reduce((s, p) => s + (p[key] || 0), 0), 2);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 bg-slate-50 border-b border-slate-200">
        <h3 className="font-bold text-slate-900">Payroll</h3>
        <p className="text-xs text-slate-500">{startDate.slice(0, 7)} to {endDate.slice(0, 7)}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100/50 border-b border-slate-200">
              {['Month', 'Staff', 'Status', 'Gross', 'Pension', 'PAYE', 'Deductions', 'Net pay'].map((h, i) => (
                <th key={h} className={cn('px-4 py-3 text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap', i >= 3 && 'text-right')}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payrolls.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400 text-sm">No payroll records found for this period.</td></tr>
            ) : payrolls.map(p => {
              const staff = staffList.find(s => s.id === p.staffId);
              return (
                <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs font-bold text-slate-900">{p.month}</td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-900 text-sm">{staff?.name || 'Unknown'}</p>
                    <p className="text-[9px] text-slate-400 uppercase">{staff?.role}</p>
                  </td>
                  <td className="px-4 py-3"><span className={cn('text-[9px] font-black px-2 py-0.5 rounded-full', p.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>{p.status}</span></td>
                  <td className="px-4 py-3 text-xs text-right text-slate-600">{formatCurrency(p.grossIncome)}</td>
                  <td className="px-4 py-3 text-xs text-right text-rose-500">{formatCurrency(p.pension)}</td>
                  <td className="px-4 py-3 text-xs text-right text-rose-500">{formatCurrency(p.paye)}</td>
                  <td className="px-4 py-3 text-xs text-right text-rose-500">{formatCurrency(p.otherDeductions || 0)}</td>
                  <td className="px-4 py-3 text-sm font-black text-indigo-600 text-right">{formatCurrency(p.netPay)}</td>
                </tr>
              );
            })}
          </tbody>
          {payrolls.length > 0 && (
            <tfoot className="bg-slate-50 border-t border-slate-200">
              <tr className="text-xs font-black text-right">
                <td colSpan={3} className="px-4 py-3 uppercase">Totals</td>
                <td className="px-4 py-3">{formatCurrency(total('grossIncome'))}</td>
                <td className="px-4 py-3">{formatCurrency(total('pension'))}</td>
                <td className="px-4 py-3">{formatCurrency(total('paye'))}</td>
                <td className="px-4 py-3">{formatCurrency(total('otherDeductions'))}</td>
                <td className="px-4 py-3 text-indigo-600">{formatCurrency(total('netPay'))}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
