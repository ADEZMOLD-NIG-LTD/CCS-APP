/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ArrowDownRight, ArrowUpRight, Receipt } from 'lucide-react';
import { motion } from 'motion/react';
import type { CashMovement } from '../../lib/finance';
import type { Warehouse } from '../../types';
import { formatCurrency, roundTo } from '../../lib/utils';

interface JournalReportProps {
  movements: CashMovement[];
  warehouses: Warehouse[];
}

export default function JournalReport({ movements, warehouses }: JournalReportProps) {
  const totalInflow = roundTo(movements.filter(m => m.direction === 'IN').reduce((s, m) => s + m.amount, 0), 2);
  const totalOutflow = roundTo(movements.filter(m => m.direction === 'OUT').reduce((s, m) => s + m.amount, 0), 2);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Cash in', value: totalInflow, icon: ArrowUpRight, tone: 'bg-emerald-50 border-emerald-100 text-emerald-700' },
          { label: 'Cash out', value: totalOutflow, icon: ArrowDownRight, tone: 'bg-rose-50 border-rose-100 text-rose-700' },
          { label: 'Net movement', value: roundTo(totalInflow - totalOutflow, 2), icon: Receipt, tone: 'bg-indigo-50 border-indigo-100 text-indigo-700' },
        ].map(card => (
          <div key={card.label} className={`p-6 rounded-3xl border ${card.tone}`}>
            <p className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 mb-2"><card.icon size={16} /> {card.label}</p>
            <p className="text-2xl font-black">{formatCurrency(card.value)}</p>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-slate-500 px-1">Includes supplier payments and customer receipts. Supplier/customer charges, deductions and petty cash retirements are excluded because they do not move cash.</p>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Date', 'Channel', 'Category', 'Warehouse', 'Description', 'In', 'Out'].map((h, i) => (
                  <th key={h} className={`px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider ${i >= 5 ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {movements.map(m => (
                <tr key={`${m.source}-${m.id}`} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4 text-xs font-bold text-slate-900 whitespace-nowrap">{new Date(m.date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-[10px] font-bold text-slate-500">{m.channel}</td>
                  <td className="px-6 py-4 text-xs font-medium text-slate-600">{m.category.replace(/_/g, ' ')}</td>
                  <td className="px-6 py-4 text-xs font-medium text-slate-600">{warehouses.find(w => w.id === m.warehouseId)?.name || '-'}</td>
                  <td className="px-6 py-4 text-xs text-slate-600 max-w-xs truncate">{m.description}</td>
                  <td className="px-6 py-4 text-right text-xs font-black text-emerald-600">{m.direction === 'IN' ? formatCurrency(m.amount) : '-'}</td>
                  <td className="px-6 py-4 text-right text-xs font-black text-rose-600">{m.direction === 'OUT' ? formatCurrency(m.amount) : '-'}</td>
                </tr>
              ))}
              {movements.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-20 text-center text-slate-400 italic text-sm">No records found for the selected period.</td></tr>
              )}
            </tbody>
            <tfoot className="bg-slate-50 border-t border-slate-200">
              <tr>
                <td colSpan={5} className="px-6 py-4 text-xs font-black text-slate-900 text-right uppercase">Totals</td>
                <td className="px-6 py-4 text-right text-xs font-black text-emerald-600">{formatCurrency(totalInflow)}</td>
                <td className="px-6 py-4 text-right text-xs font-black text-rose-600">{formatCurrency(totalOutflow)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
