/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Banknote, Calculator, CreditCard, Download, FileText } from 'lucide-react';
import type { Payroll, Staff } from '../../types';
import { ROLE_LABELS } from '../../lib/permissions';
import { NTA_2025_EFFECTIVE_MONTH } from '../../lib/finance';
import { cn, formatCurrency, roundTo } from '../../lib/utils';

interface PayrollManagerProps {
  payrolls: Payroll[];
  staffList: Staff[];
  month: string;
  canManage: boolean;
  submitting: boolean;
  onExportCSV: () => void;
  onGenerate: () => void;
  onViewPayslip: (payroll: Payroll) => void;
  onEditDeductions: (payroll: Payroll) => void;
  onPay: (payrolls: Payroll[]) => void;
}

export default function PayrollManager({ payrolls, staffList, month, canManage, submitting, onExportCSV, onGenerate, onViewPayslip, onEditDeductions, onPay }: PayrollManagerProps) {
  const pending = payrolls.filter(p => p.status === 'PENDING');
  const total = payrolls.reduce((sum, p) => sum + roundTo(p.netPay || 0, 2), 0);
  const usesNewLaw = month >= NTA_2025_EFFECTIVE_MONTH;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex-1 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Net payroll · {month}</p>
            <p className="text-xl font-black text-slate-900">{formatCurrency(total)}</p>
            <p className="text-[10px] text-slate-400">{pending.length} pending · {payrolls.length - pending.length} paid</p>
          </div>
          <Calculator className="text-indigo-600" size={24} />
        </div>
        <div className="flex gap-2">
          <button onClick={onExportCSV} disabled={payrolls.length === 0} className="bg-white text-slate-600 border border-slate-200 px-4 py-4 rounded-2xl font-bold shadow-sm disabled:opacity-40" title="Export CSV" aria-label="Export CSV">
            <Download size={18} />
          </button>
          {canManage && (
            <>
              <button onClick={onGenerate} disabled={submitting} className="bg-indigo-600 text-white px-5 py-4 rounded-2xl font-bold shadow-lg flex items-center gap-2 disabled:opacity-50">
                <CreditCard size={18} /> Generate
              </button>
              <button onClick={() => onPay(pending)} disabled={submitting || pending.length === 0} className="bg-emerald-600 text-white px-5 py-4 rounded-2xl font-bold shadow-lg flex items-center gap-2 disabled:opacity-50">
                <Banknote size={18} /> Pay all
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Staff', 'Gross', 'Pension', 'PAYE', 'Deductions', 'Net pay', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payrolls.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400 text-sm">No payroll for this month yet.{canManage ? ' Press Generate to compute it.' : ''}</td>
                </tr>
              ) : (
                payrolls.map(p => {
                  const staff = staffList.find(s => s.id === p.staffId);
                  const editable = canManage && p.status === 'PENDING';
                  return (
                    <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-4">
                        <p className="font-bold text-slate-900 text-sm">{staff?.name || 'Former staff'}</p>
                        <p className="text-[9px] text-slate-400 uppercase">{staff ? ROLE_LABELS[staff.role] ?? staff.role : ''}</p>
                      </td>
                      <td className="px-4 py-4 text-xs font-medium text-slate-600">{formatCurrency(p.grossIncome)}</td>
                      <td className="px-4 py-4 text-xs font-medium text-rose-500">-{formatCurrency(p.pension)}</td>
                      <td className="px-4 py-4 text-xs font-medium text-rose-500">-{formatCurrency(p.paye)}</td>
                      <td className="px-4 py-4 text-xs font-medium text-rose-500">
                        {editable ? (
                          <button type="button" onClick={() => onEditDeductions(p)} className="hover:underline text-left" title={p.deductionsNote || 'Add loans, advances, etc.'}>
                            {p.otherDeductions ? `-${formatCurrency(p.otherDeductions)}` : <span className="text-slate-300">Add…</span>}
                          </button>
                        ) : p.otherDeductions ? `-${formatCurrency(p.otherDeductions)}` : '—'}
                        {p.deductionsNote && <p className="text-[9px] text-slate-400 truncate max-w-[120px]">{p.deductionsNote}</p>}
                      </td>
                      <td className="px-4 py-4 text-sm font-black text-indigo-600">{formatCurrency(p.netPay)}</td>
                      <td className="px-4 py-4">
                        <span className={cn('text-[9px] font-black uppercase px-2 py-1 rounded-lg', p.status === 'PAID' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>{p.status}</span>
                      </td>
                      <td className="px-4 py-4 text-right whitespace-nowrap">
                        {editable && (
                          <button type="button" onClick={() => onPay([p])} className="text-[10px] font-bold text-emerald-600 hover:underline mr-3">Pay</button>
                        )}
                        <button type="button" onClick={() => onViewPayslip(p)} className="text-slate-400 hover:text-indigo-600" aria-label="View payslip"><FileText size={16} /></button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-3">
        <FileText className="text-amber-600 shrink-0" size={20} />
        <div>
          <h4 className="text-sm font-bold text-amber-900">Tax basis for {month}</h4>
          <p className="text-xs text-amber-700 mt-1 leading-relaxed">
            {usesNewLaw
              ? 'Nigeria Tax Act 2025: first ₦800,000 of annual taxable income at 0%, then 15%–25% bands. Reliefs: employee pension (8%) and rent relief (20% of annual rent, capped at ₦500,000).'
              : 'Personal Income Tax Act (pre-2026): Consolidated Relief Allowance, 8% pension relief, 7%–24% bands and a 1% minimum tax.'}
            {' '}Paid payroll is locked and posted to the journal. Confirm figures with your tax adviser before filing.
          </p>
        </div>
      </div>
    </div>
  );
}
