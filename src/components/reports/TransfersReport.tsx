/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { Transaction, BagTransaction, Warehouse } from '../../types';
import { cn, formatNumber } from '../../lib/utils';

interface TransfersReportProps {
  filteredTransfers: ((Transaction & { transferType: 'COMMODITY' }) | (BagTransaction & { transferType: 'BAG' }))[];
  warehouses: Warehouse[];
  startDate: string;
  endDate: string;
}

export default function TransfersReport({
  filteredTransfers,
  warehouses,
  startDate,
  endDate
}: TransfersReportProps) {
  return (
    <div className="space-y-4">
      <div className="bg-indigo-600 rounded-2xl p-4 text-white shadow-lg flex justify-between items-center">
        <div>
          <p className="text-[10px] font-bold uppercase opacity-60">Total Transfers</p>
          <h2 className="text-2xl font-black">{filteredTransfers.length}</h2>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase opacity-60">Period</p>
          <h2 className="text-sm font-bold">{startDate} to {endDate}</h2>
        </div>
      </div>

      <div className="space-y-2">
        {filteredTransfers.length === 0 ? (
          <p className="text-center py-12 text-slate-400 text-xs bg-white rounded-2xl border border-dashed border-slate-200">No transfers found for this period</p>
        ) : (
          filteredTransfers.map((t) => (
            <div key={t.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn(
                      "text-[8px] font-bold px-1.5 py-0.5 rounded uppercase",
                      t.transferType === 'COMMODITY' ? "bg-indigo-100 text-indigo-700" : "bg-amber-100 text-amber-700"
                    )}>
                      {t.transferType}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">{new Date(t.date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-900 font-bold">
                    <span className="text-sm">{warehouses.find(w => w.id === t.sourceWarehouseId)?.name || 'Unknown'}</span>
                    <ArrowRightLeft size={14} className="text-slate-300" />
                    <span className="text-sm">{warehouses.find(w => w.id === t.destinationWarehouseId)?.name || 'Unknown'}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wider">
                    {t.transferType === 'COMMODITY' ? (t as Transaction).commodity : (t as BagTransaction).packagingType.replace('_', ' ')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-slate-900">
                    {t.transferType === 'COMMODITY' ? `${formatNumber((t as Transaction).netWeight)}kg` : `${formatNumber((t as BagTransaction).quantity, 0)} units`}
                  </p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">{(t as any).reference || (t as any).referenceId}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
