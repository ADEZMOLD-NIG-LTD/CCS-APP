/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { History, Package, Edit, Trash2 } from 'lucide-react';
import { Transaction, BagTransaction, Supplier, Warehouse } from '../../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TransactionListProps {
  activeTab: 'COMMODITIES' | 'PACKAGING';
  transactions: Transaction[];
  bagTransactions: BagTransaction[];
  suppliers: Supplier[];
  warehouses: Warehouse[];
  isAdmin: boolean;
  onEdit: (tx: Transaction) => void;
  onDelete: (txId: string) => void;
}

export default function TransactionList({
  activeTab,
  transactions,
  bagTransactions,
  suppliers,
  warehouses,
  isAdmin,
  onEdit,
  onDelete
}: TransactionListProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <History size={16} /> {activeTab === 'COMMODITIES' ? 'Recent Purchases' : 'Recent Bag Activity'}
        </h2>
      </div>

      <div className="space-y-3">
        {activeTab === 'COMMODITIES' ? (
          transactions.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-dashed border-slate-300 text-center">
              <Package className="mx-auto text-slate-200 mb-2" size={32} />
              <p className="text-xs text-slate-400">No transactions recorded yet</p>
            </div>
          ) : (
            transactions.map(tx => (
              <div key={tx.id} className="google-card p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold bg-blue-50 text-[var(--accent)] px-2 py-0.5 rounded uppercase">
                        {tx.commodity}
                      </span>
                      <span className="text-[10px] font-bold bg-slate-100 text-[var(--text-secondary)] px-2 py-0.5 rounded uppercase">
                        {warehouses.find(w => w.id === tx.warehouseId)?.name || 'Main'}
                      </span>
                      <span className="text-[10px] text-[var(--text-secondary)]">{tx.date ? new Date(tx.date).toLocaleDateString() : 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-[var(--text-primary)]">
                        {suppliers.find(s => s.id === tx.supplierId)?.name || 'Unknown Supplier'}
                      </h3>
                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => onEdit(tx)}
                            className="p-1 text-slate-400 hover:text-[var(--accent)] transition-colors"
                            title="Adjust Purchase"
                          >
                            <Edit size={14} />
                          </button>
                          <button 
                            onClick={() => onDelete(tx.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                            title="Remove Purchase"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-[var(--text-primary)]">{tx.netWeight.toFixed(2)} kg</p>
                    <p className="text-[10px] text-[var(--text-secondary)]">Net Weight</p>
                    {tx.storeRecordId && (
                      <p className="text-[9px] font-bold text-indigo-600 mt-1">
                        Store ID: {tx.storeRecordId}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-50">
                  <div className="text-center">
                    <p className="text-[9px] text-[var(--text-secondary)] uppercase">Gross</p>
                    <p className="text-[11px] font-bold">{tx.grossWeight}kg</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] text-[var(--text-secondary)] uppercase">Deductions</p>
                    <p className="text-[11px] font-bold text-rose-500">
                      -{(tx.grossWeight - tx.netWeight).toFixed(1)}kg
                    </p>
                    {tx.deductions && (
                      <div className="mt-1 flex flex-wrap gap-1 text-[7px] font-bold uppercase tracking-tighter justify-center text-[var(--text-secondary)]">
                        {((tx.deductions.moistureActual - tx.deductions.moistureBenchmark) * (tx.grossWeight || 0) / 100) > 0 && (
                          <span>M: {(((tx.deductions.moistureActual - tx.deductions.moistureBenchmark) * (tx.grossWeight || 0)) / 100).toFixed(1)}kg</span>
                        )}
                        {tx.deductions.tareWeight > 0 && <span>T: {tx.deductions.tareWeight}kg</span>}
                        {tx.deductions.moldWeight > 0 && <span>Q: {tx.deductions.moldWeight}kg</span>}
                        {tx.deductions.otherDeduction > 0 && <span>O: {tx.deductions.otherDeduction}kg</span>}
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] text-[var(--text-secondary)] uppercase">Value</p>
                    <p className="text-[11px] font-bold text-emerald-600">₦{(tx.totalValue || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))
          )
        ) : (
          bagTransactions.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-dashed border-slate-300 text-center">
              <Package className="mx-auto text-slate-200 mb-2" size={32} />
              <p className="text-xs text-slate-400">No bag transactions recorded yet</p>
            </div>
          ) : (
            bagTransactions.map(tx => (
              <div key={tx.id} className="google-card p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded uppercase",
                        tx.type === 'STOCK_IN' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      )}>
                        {tx.type?.replace('_', ' ') || 'N/A'}
                      </span>
                      <span className="text-[10px] font-bold bg-slate-100 text-[var(--text-secondary)] px-2 py-0.5 rounded uppercase">
                        {tx.packagingType?.replace('_', ' ') || 'N/A'}
                      </span>
                      <span className="text-[10px] text-[var(--text-secondary)]">{tx.date ? new Date(tx.date).toLocaleDateString() : 'N/A'}</span>
                    </div>
                    <h3 className="font-bold text-[var(--text-primary)]">{tx.reference}</h3>
                    <p className="text-[10px] text-[var(--text-secondary)]">
                      Warehouse: {warehouses.find(w => w.id === tx.warehouseId)?.name || 'Main'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      "text-lg font-bold",
                      tx.type === 'STOCK_IN' ? "text-emerald-600" : "text-amber-600"
                    )}>
                      {tx.type === 'STOCK_IN' ? '+' : '-'}{tx.quantity}
                    </p>
                    <p className="text-[10px] text-[var(--text-secondary)]">Units</p>
                  </div>
                </div>
              </div>
            ))
          )
        )}
      </div>
    </section>
  );
}
