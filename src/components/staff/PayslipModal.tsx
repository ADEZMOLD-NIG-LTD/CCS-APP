/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download } from 'lucide-react';
import { Payroll, Staff } from '../../types';
import { formatCurrency } from '../../lib/utils';

interface PayslipModalProps {
  viewingPayroll: Payroll | null;
  staffList: Staff[];
  onClose: () => void;
}

export default function PayslipModal({
  viewingPayroll,
  staffList,
  onClose
}: PayslipModalProps) {
  if (!viewingPayroll) return null;

  const staff = staffList.find(s => s.id === viewingPayroll.staffId);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-indigo-600 p-6 text-white text-center">
          <h2 className="text-xl font-black uppercase tracking-widest">Payslip</h2>
          <p className="text-indigo-100 text-xs mt-1 font-bold">{viewingPayroll.month}</p>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="flex justify-between items-start border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {staff?.name}
              </h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                {staff?.role}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Net Pay</p>
              <p className="text-xl font-black text-indigo-600">{formatCurrency(viewingPayroll.netPay)}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Basic Salary</span>
              <span className="font-bold text-slate-900">{formatCurrency(viewingPayroll.basicSalary)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Allowances</span>
              <span className="font-bold text-slate-900">{formatCurrency(viewingPayroll.allowances)}</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-slate-50">
              <span className="font-bold text-slate-900">Gross Income</span>
              <span className="font-bold text-slate-900">{formatCurrency(viewingPayroll.grossIncome)}</span>
            </div>
          </div>

          <div className="space-y-3 bg-slate-50 p-4 rounded-2xl">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Deductions</p>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Pension (8%)</span>
              <span className="font-bold text-rose-500">-{formatCurrency(viewingPayroll.pension)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">PAYE Tax</span>
              <span className="font-bold text-rose-500">-{formatCurrency(viewingPayroll.paye)}</span>
            </div>
            {!!viewingPayroll.otherDeductions && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Other Deductions {viewingPayroll.deductionsNote && <span className="text-[10px] text-slate-400">({viewingPayroll.deductionsNote})</span>}</span>
                <span className="font-bold text-rose-500">-{formatCurrency(viewingPayroll.otherDeductions)}</span>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-dashed border-slate-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Bank Account</p>
                <p className="text-sm font-bold text-slate-700">
                  {staff?.bankName || 'N/A'}
                </p>
                <p className="text-xs text-slate-500">
                  {staff?.accountName || 'No Account Name'} - {staff?.accountNumber || 'N/A'}
                </p>
              </div>
              <button 
                onClick={() => window.print()}
                className="bg-slate-100 text-slate-600 p-3 rounded-xl hover:bg-slate-200 transition-colors"
              >
                <Download size={20} />
              </button>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full py-4 text-slate-400 font-bold text-sm hover:text-slate-600 transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
