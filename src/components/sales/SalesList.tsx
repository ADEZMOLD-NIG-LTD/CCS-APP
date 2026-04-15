/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { History, TrendingUp, Trash2, Truck } from 'lucide-react';
import { Transaction, Buyer, Warehouse, Supplier } from '../../types';

interface SalesListProps {
  filteredSales: Transaction[];
  buyers: Buyer[];
  suppliers: Supplier[];
  warehouses: Warehouse[];
  isAdmin: boolean;
  onDeleteSale: (id: string) => void;
}

export default function SalesList({
  filteredSales,
  buyers,
  suppliers,
  warehouses,
  isAdmin,
  onDeleteSale
}: SalesListProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
        <History size={16} /> Recent Sales
      </h2>
      <div className="space-y-3">
        {filteredSales.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-dashed border-slate-300 text-center">
            <TrendingUp className="mx-auto text-slate-200 mb-2" size={32} />
            <p className="text-xs text-slate-400">No sales recorded yet</p>
          </div>
        ) : (
          filteredSales.map(tx => (
            <div key={tx.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded uppercase">
                      {tx.commodity}
                    </span>
                    {tx.isDirectDelivery ? (
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded uppercase flex items-center gap-1">
                        <Truck size={10} /> Direct Delivery
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded uppercase">
                        {warehouses.find(w => w.id === tx.warehouseId)?.name || 'Main'}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400">{tx.date ? new Date(tx.date).toLocaleDateString() : 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900">
                      {buyers.find(b => b.id === tx.buyerId)?.name || 'Unknown Buyer'}
                    </h3>
                    {isAdmin && (
                      <button 
                        onClick={() => onDeleteSale(tx.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                        title="Remove Sale"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  {tx.isDirectDelivery && tx.supplierId && (
                    <p className="text-[10px] text-slate-500 font-medium">
                      From: <span className="font-bold">{suppliers.find(s => s.id === tx.supplierId)?.name || 'Unknown Supplier'}</span>
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-900">{tx.netWeight.toFixed(2)} kg</p>
                  <p className="text-[10px] text-slate-400">Net Weight</p>
                  {tx.storeRecordId && (
                    <p className="text-[9px] font-bold text-blue-600 mt-1">
                      Store ID: {tx.storeRecordId}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-50">
                <div className="text-left">
                  <p className="text-[9px] text-slate-400 uppercase">Total Value</p>
                  <p className="text-[11px] font-bold text-blue-600">₦{(tx.totalValue || 0).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] text-slate-400 uppercase">Ref</p>
                  <p className="text-[11px] font-bold text-slate-600">{tx.referenceId}</p>
                </div>
              </div>

              {(tx.truckNo || tx.driverName || tx.notes) && (
                <div className="mt-3 pt-3 border-t border-slate-50 grid grid-cols-2 gap-x-4 gap-y-2">
                  {tx.truckNo && (
                    <div>
                      <p className="text-[8px] text-slate-400 uppercase">Truck No</p>
                      <p className="text-[10px] font-medium text-slate-700">{tx.truckNo}</p>
                    </div>
                  )}
                  {tx.driverName && (
                    <div>
                      <p className="text-[8px] text-slate-400 uppercase">Driver</p>
                      <p className="text-[10px] font-medium text-slate-700">{tx.driverName} {tx.driverPhone ? `(${tx.driverPhone})` : ''}</p>
                    </div>
                  )}
                  {tx.staffName && (
                    <div>
                      <p className="text-[8px] text-slate-400 uppercase">Staff</p>
                      <p className="text-[10px] font-medium text-slate-700">{tx.staffName}</p>
                    </div>
                  )}
                  {tx.notes && (
                    <div className="col-span-2">
                      <p className="text-[8px] text-slate-400 uppercase">Notes</p>
                      <p className="text-[10px] font-medium text-slate-700 italic">"{tx.notes}"</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
