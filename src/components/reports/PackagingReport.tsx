/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { BagTransaction, Supplier, Warehouse } from '../../types';
import { cn, formatNumber } from '../../lib/utils';

interface PackagingReportProps {
  /** Balance per bag type as at the end date. */
  bagLevels: Record<string, number>;
  /** Movements in the period, already filtered to the selected warehouse. */
  bagTransactions: BagTransaction[];
  warehouses: Warehouse[];
  suppliers: Supplier[];
  selectedWarehouseId: string;
  endDate: string;
}

/** Direction of a movement from the point of view of the selected warehouse. */
function signFor(b: BagTransaction, warehouseId: string): 1 | -1 | 0 {
  if (b.type === 'STOCK_IN' || b.type === 'RETURN') return 1;
  if (b.type === 'ISSUE') return -1;
  if (warehouseId === 'ALL') return 0;
  return b.destinationWarehouseId === warehouseId ? 1 : -1;
}

export default function PackagingReport({ bagLevels, bagTransactions, warehouses, suppliers, selectedWarehouseId, endDate }: PackagingReportProps) {
  const name = (id?: string) => warehouses.find(w => w.id === id)?.name || 'Unknown';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-amber-600 rounded-2xl p-4 text-white shadow-lg">
          <p className="text-[10px] font-bold uppercase opacity-60 mb-1">Jute bags · as at {endDate}</p>
          <h2 className="text-xl font-black">{formatNumber(bagLevels.JUTE_BAG || 0, 0)} pcs</h2>
        </div>
        <div className="bg-slate-600 rounded-2xl p-4 text-white shadow-lg">
          <p className="text-[10px] font-bold uppercase opacity-60 mb-1">Nylon bags · as at {endDate}</p>
          <h2 className="text-xl font-black">{formatNumber(bagLevels.NYLON_BAG || 0, 0)} pcs</h2>
        </div>
      </div>

      <section className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Movements in period</h3>
        {bagTransactions.length === 0 ? (
          <p className="text-center py-8 text-slate-400 text-xs bg-white rounded-2xl border border-dashed border-slate-200">No bag movements found</p>
        ) : bagTransactions.map(b => {
          const sign = signFor(b, selectedWarehouseId);
          const supplier = b.supplierId ? suppliers.find(s => s.id === b.supplierId)?.name : undefined;
          return (
            <div key={b.id} className="bg-white p-4 rounded-2xl border border-slate-200 flex justify-between items-center shadow-sm gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn('text-[8px] font-bold px-1.5 py-0.5 rounded uppercase', sign > 0 ? 'bg-emerald-100 text-emerald-700' : sign < 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>{b.type.replace('_', ' ')}</span>
                  <span className="text-[8px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded uppercase">{b.packagingType.replace('_', ' ')}</span>
                </div>
                <p className="font-bold text-slate-900 text-sm truncate">
                  {b.type === 'TRANSFER' ? `${name(b.sourceWarehouseId)} → ${name(b.destinationWarehouseId)}` : `${name(b.warehouseId)}${supplier ? ` · ${supplier}` : ''}`}
                </p>
                <p className="text-[10px] text-slate-400">{new Date(b.date).toLocaleDateString()} · {b.reference}</p>
              </div>
              <p className={cn('text-lg font-black shrink-0', sign > 0 ? 'text-emerald-600' : sign < 0 ? 'text-amber-600' : 'text-slate-500')}>
                {sign > 0 ? '+' : sign < 0 ? '-' : '↔'}{formatNumber(b.quantity, 0)}
              </p>
            </div>
          );
        })}
      </section>
    </div>
  );
}
