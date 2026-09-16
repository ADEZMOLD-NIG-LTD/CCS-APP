/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { Buyer, Supplier, Transaction, Warehouse } from '../../types';
import { deductionSummary, partyName, signedFor, TRANSACTION_LABELS } from '../../services/reportService';
import { cn, formatCurrency, formatNumber, roundTo } from '../../lib/utils';

interface OperationalTransactionsReportProps {
  type: 'PURCHASES' | 'SALES';
  transactions: Transaction[];
  warehouses: Warehouse[];
  suppliers: Supplier[];
  buyers: Buyer[];
}

export default function OperationalTransactionsReport({ type, transactions, warehouses, suppliers, buyers }: OperationalTransactionsReportProps) {
  const totalValue = roundTo(transactions.reduce((s, t) => s + signedFor(t) * (t.totalValue || 0), 0), 2);
  const totalKg = roundTo(transactions.reduce((s, t) => s + signedFor(t) * (t.netWeight || 0), 0), 2);

  return (
    <div className="space-y-3">
      <div className="bg-indigo-600 rounded-2xl p-4 text-white shadow-lg flex justify-between items-center gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase opacity-60">Net {type === 'PURCHASES' ? 'purchases' : 'sales'} (after returns)</p>
          <h2 className="text-2xl font-black">{formatCurrency(totalValue)}</h2>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase opacity-60">Net weight</p>
          <h2 className="text-2xl font-black">{formatNumber(totalKg)}kg</h2>
        </div>
      </div>

      {transactions.length === 0 && <p className="text-center py-12 text-slate-400 text-xs bg-white rounded-2xl border border-dashed border-slate-200">No records for this period.</p>}

      {transactions.map(t => {
        const isReturn = signedFor(t) < 0;
        const deductions = deductionSummary(t);
        return (
          <div key={t.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('text-[8px] font-black px-1.5 py-0.5 rounded uppercase', isReturn ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700')}>{TRANSACTION_LABELS[t.type]}</span>
                  {t.isDirectDelivery && <span className="text-[8px] font-black px-1.5 py-0.5 rounded uppercase bg-amber-100 text-amber-700">Direct delivery</span>}
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{t.commodity} · {t.isDirectDelivery ? 'No warehouse' : warehouses.find(w => w.id === t.warehouseId)?.name || 'Unknown warehouse'}</span>
                </div>
                <h3 className="font-bold text-slate-900 truncate">{partyName(t, suppliers, buyers)}</h3>
                <p className="text-[10px] text-slate-400">{new Date(t.date).toLocaleDateString()} · Ref {t.referenceId}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={cn('font-black', isReturn ? 'text-rose-600' : 'text-slate-900')}>{isReturn ? '-' : ''}{formatCurrency(t.totalValue || 0)}</p>
                <div className="flex flex-wrap gap-1.5 text-[8px] font-bold uppercase justify-end">
                  <span className="text-blue-600">Bags {t.noOfBags || t.bags || '-'}</span>
                  <span className="text-slate-500">G {formatNumber(t.grossWeight)}kg</span>
                  <span className="text-rose-500">D {formatNumber(Math.max(0, roundTo(t.grossWeight - t.netWeight, 2)))}kg</span>
                  <span className="text-emerald-600">N {formatNumber(t.netWeight)}kg</span>
                  <span className="text-amber-600">{formatCurrency(t.pricePerKg || 0)}/kg</span>
                </div>
                {deductions && <p className="mt-1 text-[8px] font-bold uppercase text-slate-400">{deductions}</p>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
