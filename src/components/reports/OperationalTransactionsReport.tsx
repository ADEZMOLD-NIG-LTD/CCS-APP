/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Transaction, Warehouse } from '../../types';
import { roundTo, formatNumber, formatCurrency } from '../../lib/utils';

interface OperationalTransactionsReportProps {
  type: 'PURCHASES' | 'SALES';
  filteredOperationalTx: Transaction[];
  warehouses: Warehouse[];
}

export default function OperationalTransactionsReport({
  type,
  filteredOperationalTx,
  warehouses
}: OperationalTransactionsReportProps) {
  return (
    <div className="space-y-3">
      <div className="bg-indigo-600 rounded-2xl p-4 text-white shadow-lg flex justify-between items-center">
        <div>
          <p className="text-[10px] font-bold uppercase opacity-60">Total {type === 'PURCHASES' ? 'Purchases' : 'Sales'}</p>
          <h2 className="text-2xl font-black">{formatCurrency(filteredOperationalTx.reduce((sum, t) => sum + roundTo(t.totalValue || 0, 2), 0))}</h2>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase opacity-60">Total Weight</p>
          <h2 className="text-2xl font-black">{formatNumber(filteredOperationalTx.reduce((sum, t) => sum + roundTo(t.netWeight || 0, 2), 0))}kg</h2>
        </div>
      </div>

      {filteredOperationalTx.map(t => (
        <div key={t.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">
                {t.commodity} | {warehouses.find(w => w.id === t.warehouseId)?.name || t.warehouse || 'Main'}
              </p>
              <h3 className="font-bold text-slate-900">{t.referenceId}</h3>
              <p className="text-[10px] text-slate-400">{new Date(t.date).toLocaleDateString()}</p>
            </div>
            <div className="text-right">
              <p className="font-black text-slate-900">{formatCurrency(t.totalValue || 0)}</p>
              <div className="flex flex-wrap gap-1.5 text-[8px] font-bold uppercase tracking-tighter justify-end">
                <span className="text-blue-600">Bags: {t.noOfBags || t.bags || '-'}</span>
                <span className="text-slate-500">G: {formatNumber(t.grossWeight)}kg</span>
                <span className="text-rose-500">D: {formatNumber(roundTo(t.grossWeight - t.netWeight, 2))}kg</span>
                <span className="text-emerald-600">N: {formatNumber(t.netWeight)}kg</span>
                <span className="text-amber-600">Price: {formatCurrency(t.pricePerKg || 0)}</span>
              </div>
              {t.deductions && (
                <div className="mt-1 flex flex-wrap gap-1.5 text-[7px] font-bold uppercase tracking-tighter justify-end text-slate-400">
                  {((t.deductions.moistureActual - t.deductions.moistureBenchmark) * (t.grossWeight || 0) / 100) > 0 && (
                    <span>Moisture: {formatNumber(roundTo(((t.deductions.moistureActual - t.deductions.moistureBenchmark) * (t.grossWeight || 0)) / 100, 2))}kg</span>
                  )}
                  {t.deductions.tareWeight > 0 && <span>Tare: {formatNumber(t.deductions.tareWeight)}kg</span>}
                  {t.deductions.moldWeight > 0 && <span>Mold: {formatNumber(t.deductions.moldWeight)}kg</span>}
                  {t.deductions.otherDeduction > 0 && <span>Other: {formatNumber(t.deductions.otherDeduction)}kg</span>}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
