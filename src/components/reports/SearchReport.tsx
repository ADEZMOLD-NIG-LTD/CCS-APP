/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Search, FileText } from 'lucide-react';
import { Transaction, Supplier, Buyer, Warehouse } from '../../types';
import { cn } from '../../lib/utils';

interface SearchReportProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  transactions: Transaction[];
  suppliers: Supplier[];
  buyers: Buyer[];
  warehouses: Warehouse[];
}

export default function SearchReport({
  searchQuery,
  onSearchChange,
  transactions,
  suppliers,
  buyers,
  warehouses
}: SearchReportProps) {
  const filteredResults = transactions.filter(t => t.storeRecordId?.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Enter Tranx ID (Store Record ID) to search..."
            className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 text-lg font-medium"
          />
        </div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
          Search across all purchases and sales using the unique ID from Store Keeper
        </p>
      </div>

      <div className="space-y-4">
        {searchQuery.trim() === '' ? (
          <div className="bg-white rounded-2xl p-12 border border-dashed border-slate-300 text-center">
            <Search className="mx-auto text-slate-200 mb-4" size={48} />
            <p className="text-slate-400 font-medium">Enter a Tranx ID above to find linked transactions</p>
          </div>
        ) : (
          <>
            {filteredResults.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 border border-dashed border-slate-300 text-center">
                <FileText className="mx-auto text-slate-200 mb-4" size={48} />
                <p className="text-slate-400 font-medium">No transactions found matching "{searchQuery}"</p>
              </div>
            ) : (
              filteredResults.map(t => (
                <div key={t.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-300 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded uppercase",
                          t.type === 'PURCHASE' ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                        )}>
                          {t.type}
                        </span>
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded uppercase">
                          {t.commodity}
                        </span>
                        <span className="text-[10px] text-slate-400">{new Date(t.date).toLocaleString()}</span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-lg">
                        {t.type === 'PURCHASE' 
                          ? (suppliers.find(s => s.id === t.supplierId)?.name || 'Unknown Supplier')
                          : (buyers.find(b => b.id === t.buyerId)?.name || t.buyerName || 'Unknown Customer')
                        }
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">Ref: {t.referenceId}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-slate-900">₦{(t.totalValue || 0).toLocaleString()}</p>
                      <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Tranx ID: {t.storeRecordId}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-2 pt-4 border-t border-slate-50">
                    <div className="text-center">
                      <p className="text-[9px] text-slate-400 font-bold uppercase">Gross</p>
                      <p className="text-sm font-bold">{t.grossWeight}kg</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] text-slate-400 font-bold uppercase">Net</p>
                      <p className="text-sm font-bold text-emerald-600">{t.netWeight}kg</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] text-slate-400 font-bold uppercase">Bags</p>
                      <p className="text-sm font-bold">{t.noOfBags || t.bags || '-'}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] text-slate-400 font-bold uppercase">Warehouse</p>
                      <p className="text-sm font-bold truncate">
                        {warehouses.find(w => w.id === t.warehouseId)?.name || t.warehouse || 'Main'}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
