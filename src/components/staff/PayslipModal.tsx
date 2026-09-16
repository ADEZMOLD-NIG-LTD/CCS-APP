/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { Printer } from 'lucide-react';
import type { Payroll, Staff } from '../../types';
import { ROLE_LABELS } from '../../lib/permissions';
import { formatCurrency } from '../../lib/utils';

interface PayslipModalProps {
  viewingPayroll: Payroll | null;
  staffList: Staff[];
  companyName: string;
  onClose: () => void;
}

function Row({ label, value, tone = 'text-slate-900' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`font-bold ${tone}`}>{value}</span>
    </div>
  );
}

export default function PayslipModal({ viewingPayroll, staffList, companyName, onClose }: PayslipModalProps) {
  if (!viewingPayroll) return null;
  const p = viewingPayroll;
  const staff = staffList.find(s => s.id === p.staffId);
  const maskedAccount = staff?.accountNumber ? `••••${staff.accountNumber.slice(-4)}` : 'N/A';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 print:bg-white print:static" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()} role="dialog" aria-label="Payslip">
        <div className="bg-indigo-600 p-6 text-white text-center">
          <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-widest">{companyName}</p>
          <h2 className="text-xl font-black uppercase tracking-widest">Payslip</h2>
          <p className="text-indigo-100 text-xs mt-1 font-bold">{p.month} · {p.status}</p>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex justify-between items-start border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">{staff?.name ?? 'Former staff'}</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{staff ? ROLE_LABELS[staff.role] ?? staff.role : ''}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Net pay</p>
              <p className="text-xl font-black text-indigo-600">{formatCurrency(p.netPay)}</p>
            </div>
          </div>

          <div className="space-y-3">
            <Row label="Basic salary" value={formatCurrency(p.basicSalary)} />
            <Row label="Allowances" value={formatCurrency(p.allowances)} />
            <div className="pt-2 border-t border-slate-50"><Row label="Gross income" value={formatCurrency(p.grossIncome)} /></div>
          </div>

          <div className="space-y-3 bg-slate-50 p-4 rounded-2xl">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Deductions</p>
            <Row label="Pension (employee)" value={`-${formatCurrency(p.pension)}`} tone="text-rose-500" />
            <Row label={`PAYE${p.taxRegime === 'NTA_2025' ? ' (NTA 2025)' : p.taxRegime === 'PITA_2011' ? ' (PITA)' : ''}`} value={`-${formatCurrency(p.paye)}`} tone="text-rose-500" />
            {!!p.otherDeductions && (
              <Row label={`Other${p.deductionsNote ? ` (${p.deductionsNote})` : ''}`} value={`-${formatCurrency(p.otherDeductions)}`} tone="text-rose-500" />
            )}
            {!!p.rentRelief && <p className="text-[10px] text-slate-400">Rent relief applied: {formatCurrency(p.rentRelief)} / month</p>}
          </div>

          <div className="pt-4 border-t border-dashed border-slate-200 flex justify-between items-center">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase">Bank account</p>
              <p className="text-sm font-bold text-slate-700">{staff?.bankName || 'N/A'}</p>
              <p className="text-xs text-slate-500">{staff?.accountName || '—'} · {maskedAccount}</p>
            </div>
            <button onClick={() => window.print()} className="bg-slate-100 text-slate-600 p-3 rounded-xl hover:bg-slate-200 print:hidden" aria-label="Print payslip">
              <Printer size={20} />
            </button>
          </div>

          <button onClick={onClose} className="w-full py-4 text-slate-400 font-bold text-sm hover:text-slate-600 print:hidden">Close</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
