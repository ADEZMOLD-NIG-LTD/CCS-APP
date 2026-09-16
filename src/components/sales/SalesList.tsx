/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Edit, History, Trash2, TrendingUp, Truck } from 'lucide-react';
import type { Buyer, Supplier, Transaction, Warehouse } from '../../types';
import { formatCurrency, formatNumber } from '../../lib/utils';

interface SalesListProps {
  sales: Transaction[];
  buyers: Buyer[];
  suppliers: Supplier[];
  warehouses: Warehouse[];
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
}

const PAGE = 50;

export default function SalesList({ sales, buyers, suppliers, warehouses, canEdit, canDelete, onEdit, onDelete }: SalesListProps) {
  const [visible, setVisible] = useState(PAGE);

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2"><History size={16} /> Sales</h2>
      {sales.length === 0 && (
        <div className="bg-white rounded-2xl p-8 border border-dashed border-slate-300 text-center">
          <TrendingUp className="mx-auto text-slate-200 mb-2" size={32} />
          <p className="text-xs text-slate-400">No sales recorded yet</p>
        </div>
      )}
      {sales.slice(0, visible).map(tx => {
        const buyerName = tx.buyerId ? buyers.find(b => b.id === tx.buyerId)?.name : undefined;
        const supplierName = tx.supplierId ? suppliers.find(s => s.id === tx.supplierId)?.name : undefined;
        const counterparty = buyerName ?? (tx.buyerId ? 'Unknown buyer' : supplierName ? `${supplierName} (supplier)` : tx.buyerName || 'Unknown buyer');
        return (
          <div key={tx.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-start mb-3 gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded uppercase">{tx.commodity}</span>
                  {tx.isDirectDelivery ? (
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded uppercase flex items-center gap-1"><Truck size={10} /> Direct delivery</span>
                  ) : (
                    <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded uppercase">{warehouses.find(w => w.id === tx.warehouseId)?.name || 'Unassigned'}</span>
                  )}
                  <span className="text-[10px] text-slate-400">{tx.date ? new Date(tx.date).toLocaleDateString() : 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 truncate">{counterparty}</h3>
                  {canEdit && <button onClick={() => onEdit(tx)} className="p-1 text-slate-400 hover:text-blue-600" aria-label="Adjust sale"><Edit size={14} /></button>}
                  {canDelete && <button onClick={() => onDelete(tx)} className="p-1 text-slate-400 hover:text-rose-600" aria-label="Delete sale"><Trash2 size={14} /></button>}
                </div>
                {tx.isDirectDelivery && supplierName && (
                  <p className="text-[10px] text-slate-500 font-medium">From <span className="font-bold">{supplierName}</span>{tx.supplierCreditValue ? ` · supplier credit ${formatCurrency(tx.supplierCreditValue)}` : ''}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-black text-slate-900">{formatNumber(tx.netWeight)} kg</p>
                {tx.storeRecordId && <p className="text-[9px] font-bold text-blue-600 mt-1">Store ID: {tx.storeRecordId}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-50">
              <div>
                <p className="text-[9px] text-slate-400 uppercase">Value</p>
                <p className="text-[11px] font-bold text-blue-600">{formatCurrency(tx.totalValue || 0)}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-slate-400 uppercase">Ref</p>
                <p className="text-[11px] font-bold text-slate-600">{tx.referenceId}</p>
              </div>
            </div>
            {(tx.truckNo || tx.driverName || tx.staffName || tx.notes) && (
              <div className="mt-3 pt-3 border-t border-slate-50 grid grid-cols-2 gap-x-4 gap-y-2 text-[10px]">
                {tx.truckNo && <p><span className="text-slate-400 uppercase text-[8px] block">Truck</span>{tx.truckNo}</p>}
                {tx.driverName && <p><span className="text-slate-400 uppercase text-[8px] block">Driver</span>{tx.driverName}{tx.driverPhone ? ` (${tx.driverPhone})` : ''}</p>}
                {tx.staffName && <p><span className="text-slate-400 uppercase text-[8px] block">Staff</span>{tx.staffName}</p>}
                {tx.notes && <p className="col-span-2 italic">"{tx.notes}"</p>}
              </div>
            )}
          </div>
        );
      })}
      {sales.length > visible && (
        <button onClick={() => setVisible(v => v + PAGE)} className="w-full py-3 text-xs font-bold text-blue-600 bg-white border border-slate-200 rounded-xl">
          Show more ({sales.length - visible} remaining)
        </button>
      )}
    </section>
  );
}
