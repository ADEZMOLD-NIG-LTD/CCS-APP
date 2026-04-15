/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BagTransaction } from '../../types';
import { cn } from '../../lib/utils';

interface PackagingReportProps {
  packagingInventory: Record<string, number>;
  bagTransactions: BagTransaction[];
  startDate: string;
  endDate: string;
  selectedWarehouseId: string;
}

export default function PackagingReport({
  packagingInventory,
  bagTransactions,
  startDate,
  endDate,
  selectedWarehouseId
}: PackagingReportProps) {
  const filteredBags = bagTransactions.filter(tx => {
    const date = tx.date.split('T')[0];
    return date >= startDate && date <= endDate && (selectedWarehouseId === 'ALL' || tx.warehouseId === selectedWarehouseId);
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-amber-600 rounded-2xl p-4 text-white shadow-lg">
          <p className="text-[10px] font-bold uppercase opacity-60 mb-1">Jute Bags</p>
          <h2 className="text-xl font-black">{packagingInventory['JUTE_BAG']?.toLocaleString() || 0} pcs</h2>
        </div>
        <div className="bg-slate-600 rounded-2xl p-4 text-white shadow-lg">
          <p className="text-[10px] font-bold uppercase opacity-60 mb-1">Nylon Bags</p>
          <h2 className="text-xl font-black">{packagingInventory['NYLON_BAG']?.toLocaleString() || 0} pcs</h2>
        </div>
      </div>

      <section className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Recent Bag Transactions</h3>
        <div className="space-y-2">
          {filteredBags.length === 0 ? (
            <p className="text-center py-8 text-slate-400 text-xs bg-white rounded-2xl border border-dashed border-slate-200">No bag transactions found</p>
          ) : (
            filteredBags.map(tx => (
              <div key={tx.id} className="bg-white p-4 rounded-2xl border border-slate-200 flex justify-between items-center shadow-sm">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn(
                      "text-[8px] font-bold px-1.5 py-0.5 rounded uppercase",
                      tx.type === 'STOCK_IN' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    )}>
                      {tx.type?.replace('_', ' ') || 'N/A'}
                    </span>
                    <span className="text-[8px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded uppercase">
                      {tx.packagingType?.replace('_', ' ') || 'N/A'}
                    </span>
                  </div>
                  <p className="font-bold text-slate-900 text-sm">{tx.reference}</p>
                  <p className="text-[10px] text-slate-400">{new Date(tx.date).toLocaleDateString()}</p>
                </div>
                <p className={cn(
                  "text-lg font-black",
                  tx.type === 'STOCK_IN' ? "text-emerald-600" : "text-amber-600"
                )}>
                  {tx.type === 'STOCK_IN' ? '+' : '-'}{tx.quantity}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
