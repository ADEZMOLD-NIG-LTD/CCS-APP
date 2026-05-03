/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { JournalEntry, Warehouse } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { Receipt, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { motion } from 'motion/react';

interface JournalReportProps {
  journal: JournalEntry[];
  warehouses: Warehouse[];
  startDate: string;
  endDate: string;
}

export default function JournalReport({ journal, warehouses, startDate, endDate }: JournalReportProps) {
  const totalInflow = journal.filter(e => e.type === 'INFLOW').reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalOutflow = journal.filter(e => e.type === 'OUTFLOW').reduce((sum, e) => sum + (e.amount || 0), 0);
  const netBalance = totalInflow - totalOutflow;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
              <ArrowUpRight size={18} />
            </div>
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Total Inflow</p>
          </div>
          <p className="text-2xl font-black text-emerald-700">{formatCurrency(totalInflow)}</p>
        </div>

        <div className="bg-rose-50 p-6 rounded-3xl border border-rose-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-rose-100 rounded-full flex items-center justify-center text-rose-600">
              <ArrowDownRight size={18} />
            </div>
            <p className="text-xs font-bold text-rose-600 uppercase tracking-wider">Total Outflow</p>
          </div>
          <p className="text-2xl font-black text-rose-700">{formatCurrency(totalOutflow)}</p>
        </div>

        <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
              <Receipt size={18} />
            </div>
            <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Net Balance</p>
          </div>
          <p className="text-2xl font-black text-indigo-700">{formatCurrency(netBalance)}</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Category</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Warehouse</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Description</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Inflow</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Outflow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {journal.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-xs font-bold text-slate-900">{new Date(entry.date).toLocaleDateString()}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${
                      entry.type === 'INFLOW' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                    }`}>
                      {entry.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-slate-600">{entry.category.replace('_', ' ')}</td>
                  <td className="px-6 py-4 text-xs font-medium text-slate-600">
                    {warehouses.find(w => w.id === entry.warehouseId)?.name || '-'}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-600 max-w-xs truncate">{entry.description}</td>
                  <td className="px-6 py-4 text-right">
                    <p className={`text-xs font-black ${entry.type === 'INFLOW' ? 'text-emerald-600' : 'text-slate-300'}`}>
                      {entry.type === 'INFLOW' ? formatCurrency(entry.amount) : '-'}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className={`text-xs font-black ${entry.type === 'OUTFLOW' ? 'text-rose-600' : 'text-slate-300'}`}>
                      {entry.type === 'OUTFLOW' ? formatCurrency(entry.amount) : '-'}
                    </p>
                  </td>
                </tr>
              ))}
              {journal.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center text-slate-400 italic text-sm">
                    No records found for the selected period.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
              <tr>
                <td colSpan={5} className="px-6 py-4 text-xs font-black text-slate-900 text-right uppercase">Final Balances</td>
                <td className="px-6 py-4 text-right">
                  <p className="text-xs font-black text-emerald-600">{formatCurrency(totalInflow)}</p>
                </td>
                <td className="px-6 py-4 text-right">
                  <p className="text-xs font-black text-rose-600">{formatCurrency(totalOutflow)}</p>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
