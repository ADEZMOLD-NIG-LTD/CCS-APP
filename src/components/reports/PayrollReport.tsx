/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Staff, Payroll } from '../../types';
import { formatCurrency } from '../../lib/utils';

interface PayrollReportProps {
  payrollRecords: Payroll[];
  staffList: Staff[];
  startDate: string;
  endDate: string;
}

export default function PayrollReport({
  payrollRecords,
  staffList,
  startDate,
  endDate
}: PayrollReportProps) {
  // Convert dates to YYYY-MM for comparison, assuming payroll.month is YYYY-MM
  const startMonth = startDate.substring(0, 7);
  const endMonth = endDate.substring(0, 7);

  const filteredPayrolls = payrollRecords.filter(p => {
    return p.month >= startMonth && p.month <= endMonth;
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 bg-slate-50 border-b border-slate-200">
        <h3 className="font-bold text-slate-900">Payroll Report</h3>
        <p className="text-xs text-slate-500">{startMonth} to {endMonth}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100/50 border-b border-slate-200">
              <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">Month</th>
              <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">Staff</th>
              <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">Gross</th>
              <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">Pension</th>
              <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">PAYE</th>
              <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">Deductions</th>
              <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase text-right">Net Pay</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayrolls.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-400 text-sm">
                  No payroll records found for this period.
                </td>
              </tr>
            ) : (
              filteredPayrolls.sort((a, b) => b.month.localeCompare(a.month)).map(p => {
                const staff = staffList.find(s => s.id === p.staffId);
                return (
                  <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-xs font-bold text-slate-900">{p.month}</td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-900 text-sm">{staff?.name || 'Unknown'}</p>
                      <p className="text-[9px] text-slate-400 uppercase">{staff?.role}</p>
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-600">{formatCurrency(p.grossIncome)}</td>
                    <td className="px-4 py-3 text-xs font-medium text-rose-500">-{formatCurrency(p.pension)}</td>
                    <td className="px-4 py-3 text-xs font-medium text-rose-500">-{formatCurrency(p.paye)}</td>
                    <td className="px-4 py-3 text-xs font-medium text-rose-500">-{formatCurrency(p.otherDeductions || 0)}</td>
                    <td className="px-4 py-3 text-sm font-black text-indigo-600 text-right">{formatCurrency(p.netPay)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
