/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertTriangle, CheckCircle2, Scale } from 'lucide-react';
import { cn, formatNumber } from '../../lib/utils';

export interface ReconciliationRow {
  key: string;
  warehouseId: string;
  warehouseName: string;
  commodity: string;
  /** Kilograms derived from purchases, sales, transfers and adjustments. */
  inventoryKg: number;
  /** Kilograms recorded independently by the store keeper. */
  storeKg: number;
  differenceKg: number;
}

interface ReconciliationReportProps {
  rows: ReconciliationRow[];
  asAt: string;
  /** Absolute kg difference below which a line counts as matching. */
  tolerance?: number;
}

export default function ReconciliationReport({ rows, asAt, tolerance = 1 }: ReconciliationReportProps) {
  const mismatches = rows.filter(r => Math.abs(r.differenceKg) > tolerance);
  const totalInventory = rows.reduce((s, r) => s + r.inventoryKg, 0);
  const totalStore = rows.reduce((s, r) => s + r.storeKg, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Inventory ledger</p>
          <p className="text-lg font-black text-slate-900">{formatNumber(totalInventory)}kg</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Store register</p>
          <p className="text-lg font-black text-slate-900">{formatNumber(totalStore)}kg</p>
        </div>
        <div className={cn('p-4 rounded-2xl border', mismatches.length ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200')}>
          <p className="text-[9px] font-bold uppercase mb-1 flex items-center gap-1">
            {mismatches.length ? <AlertTriangle size={12} className="text-amber-600" /> : <CheckCircle2 size={12} className="text-emerald-600" />}
            {mismatches.length ? 'Lines to investigate' : 'All lines agree'}
          </p>
          <p className="text-lg font-black text-slate-900">{mismatches.length} of {rows.length}</p>
        </div>
      </div>

      <p className="text-[10px] text-slate-500 px-1">
        Dual control: the inventory ledger comes from purchases, sales, transfers and adjustments; the store register is
        entered separately by the store keeper. Balances are as at {asAt}. A difference larger than {tolerance}kg is flagged.
      </p>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {['Warehouse', 'Commodity', 'Inventory (kg)', 'Store register (kg)', 'Difference (kg)', 'Status'].map((h, i) => (
                <th key={h} className={cn('px-4 py-3 text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap', i >= 2 && i <= 4 && 'text-right')}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400 text-sm">Nothing recorded in either ledger for this period.</td></tr>
            ) : rows.map(row => {
              const off = Math.abs(row.differenceKg) > tolerance;
              return (
                <tr key={row.key} className={cn('hover:bg-slate-50/50', off && 'bg-amber-50/40')}>
                  <td className="px-4 py-3 text-sm font-bold text-slate-900">{row.warehouseName}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{row.commodity}</td>
                  <td className="px-4 py-3 text-sm text-right text-slate-600">{formatNumber(row.inventoryKg)}</td>
                  <td className="px-4 py-3 text-sm text-right text-slate-600">{formatNumber(row.storeKg)}</td>
                  <td className={cn('px-4 py-3 text-sm text-right font-black', off ? 'text-amber-700' : 'text-slate-400')}>
                    {row.differenceKg > 0 ? '+' : ''}{formatNumber(row.differenceKg)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-[9px] font-black px-2 py-0.5 rounded-full uppercase flex items-center gap-1 w-fit', off ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700')}>
                      {off ? <><Scale size={10} /> Investigate</> : <><CheckCircle2 size={10} /> Agrees</>}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
