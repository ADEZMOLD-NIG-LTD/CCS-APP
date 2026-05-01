/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Calculator, Download, CreditCard, FileText } from 'lucide-react';
import { Payroll, Staff } from '../../types';
import { roundTo, formatCurrency } from '../../lib/utils';

interface PayrollManagerProps {
  filteredPayrolls: Payroll[];
  staffList: Staff[];
  isAdmin: boolean;
  isAccount: boolean;
  submitting: boolean;
  onExportCSV: () => void;
  onGenerate: () => void;
  onViewPayslip: (payroll: Payroll) => void;
}

export default function PayrollManager({
  filteredPayrolls,
  staffList,
  isAdmin,
  isAccount,
  submitting,
  onExportCSV,
  onGenerate,
  onViewPayslip
}: PayrollManagerProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex-1 mr-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Total Payroll Cost</p>
              <p className="text-xl font-black text-slate-900">
                {formatCurrency(filteredPayrolls.reduce((sum, p) => sum + roundTo(p.netPay || 0, 2), 0))}
              </p>
            </div>
            <Calculator className="text-indigo-600" size={24} />
          </div>
        </div>
        <div className="flex gap-2">
          {(isAdmin || isAccount) && (
            <button
              onClick={onExportCSV}
              className="bg-white text-slate-600 border border-slate-200 px-4 py-4 rounded-2xl font-bold shadow-sm flex items-center gap-2 active:scale-95 transition-all"
            >
              <Download size={18} />
            </button>
          )}
          {(isAdmin || isAccount) && (
            <button
              onClick={onGenerate}
              disabled={submitting}
              className="bg-indigo-600 text-white px-6 py-4 rounded-2xl font-bold shadow-lg flex items-center gap-2 active:scale-95 transition-all disabled:opacity-50"
            >
              <CreditCard size={18} /> Generate
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">Staff</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">Gross</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">Pension</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">PAYE</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase text-right">Net Pay</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayrolls.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400 text-sm">
                    No payroll data for this month. Click generate to compute.
                  </td>
                </tr>
              ) : (
                filteredPayrolls.map(p => {
                  const staff = staffList.find(s => s.id === p.staffId);
                  return (
                    <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-4">
                        <p className="font-bold text-slate-900 text-sm">{staff?.name || 'Unknown'}</p>
                        <p className="text-[9px] text-slate-400 uppercase">{staff?.role}</p>
                      </td>
                      <td className="px-4 py-4 text-xs font-medium text-slate-600">{formatCurrency(p.grossIncome)}</td>
                      <td className="px-4 py-4 text-xs font-medium text-rose-500">-{formatCurrency(p.pension)}</td>
                      <td className="px-4 py-4 text-xs font-medium text-rose-500">-{formatCurrency(p.paye)}</td>
                      <td className="px-4 py-4 text-sm font-black text-indigo-600 text-right">{formatCurrency(p.netPay)}</td>
                      <td className="px-4 py-4 text-right">
                        <button 
                          onClick={() => onViewPayslip(p)}
                          className="text-slate-400 hover:text-indigo-600 transition-colors"
                        >
                          <FileText size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
        <div className="flex gap-3">
          <FileText className="text-amber-600 shrink-0" size={20} />
          <div>
            <h4 className="text-sm font-bold text-amber-900">Nigerian Tax Compliance</h4>
            <p className="text-xs text-amber-700 mt-1">
              Calculations include Consolidated Relief Allowance (CRA), 8% Pension contribution, and progressive PAYE rates (7% to 24%). Minimum tax of 1% applied where applicable.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
