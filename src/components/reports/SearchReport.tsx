/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FileText, Search } from 'lucide-react';
import type { Buyer, Supplier, Transaction, Warehouse } from '../../types';
import { partyName, TRANSACTION_LABELS } from '../../services/reportService';
import { cn, formatCurrency, formatNumber } from '../../lib/utils';

interface SearchReportProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  results: Transaction[];
  suppliers: Supplier[];
  buyers: Buyer[];
  warehouses: Warehouse[];
}

export default function SearchReport({ searchQuery, onSearchChange, results, suppliers, buyers, warehouses }: SearchReportProps) {
  const tooShort = searchQuery.trim().length < 2;

  return (
    <div className="space-y-4">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="search"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Tranx ID, reference or transaction ID…"
            aria-label="Search transactions"
            className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 text-lg font-medium"
          />
        </div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Matches the store keeper Tranx ID, the transaction reference or its ID</p>
      </div>

      {tooShort ? (
        <div className="bg-white rounded-2xl p-12 border border-dashed border-slate-300 text-center">
          <Search className="mx-auto text-slate-200 mb-4" size={48} />
          <p className="text-slate-400 font-medium">Enter at least two characters</p>
        </div>
      ) : results.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-dashed border-slate-300 text-center">
          <FileText className="mx-auto text-slate-200 mb-4" size={48} />
          <p className="text-slate-400 font-medium">No transactions match "{searchQuery}"</p>
        </div>
      ) : results.map(t => (
        <div key={t.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start gap-3 mb-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded uppercase', t.type === 'PURCHASE' ? 'bg-emerald-100 text-emerald-700' : t.type === 'SALE' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700')}>{TRANSACTION_LABELS[t.type]}</span>
                <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded uppercase">{t.commodity}</span>
                <span className="text-[10px] text-slate-400">{new Date(t.date).toLocaleDateString()}</span>
              </div>
              <h3 className="font-bold text-slate-900 text-lg truncate">{partyName(t, suppliers, buyers)}</h3>
              <p className="text-xs text-slate-500 font-medium">Ref: {t.referenceId}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xl font-black text-slate-900">{t.type === 'TRANSFER' ? '-' : formatCurrency(t.totalValue || 0)}</p>
              {t.storeRecordId && <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Tranx ID: {t.storeRecordId}</p>}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 pt-4 border-t border-slate-50 text-center">
            <div><p className="text-[9px] text-slate-400 font-bold uppercase">Gross</p><p className="text-sm font-bold">{formatNumber(t.grossWeight)}kg</p></div>
            <div><p className="text-[9px] text-slate-400 font-bold uppercase">Net</p><p className="text-sm font-bold text-emerald-600">{formatNumber(t.netWeight)}kg</p></div>
            <div><p className="text-[9px] text-slate-400 font-bold uppercase">Bags</p><p className="text-sm font-bold">{t.noOfBags || t.bags || '-'}</p></div>
            <div>
              <p className="text-[9px] text-slate-400 font-bold uppercase">Warehouse</p>
              <p className="text-sm font-bold truncate">
                {t.type === 'TRANSFER'
                  ? `${warehouses.find(w => w.id === t.sourceWarehouseId)?.name || '?'} → ${warehouses.find(w => w.id === t.destinationWarehouseId)?.name || '?'}`
                  : t.isDirectDelivery ? 'Direct' : warehouses.find(w => w.id === t.warehouseId)?.name || '-'}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
