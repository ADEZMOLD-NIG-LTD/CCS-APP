/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { PackagingType, Supplier, Warehouse, UserProfile } from '../../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const PACKAGING: PackagingType[] = ['JUTE_BAG', 'NYLON_BAG'];

interface BagTransactionFormProps {
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  suppliers: Supplier[];
  warehouses: Warehouse[];
  getWarehouseBagStock: (warehouseId: string, pkgType: PackagingType) => number;
  profile: UserProfile | null;
  submitting: boolean;
}

export default function BagTransactionForm({
  onSubmit,
  onCancel,
  suppliers,
  warehouses,
  getWarehouseBagStock,
  profile,
  submitting
}: BagTransactionFormProps) {
  const [bagOpType, setBagOpType] = useState<'STOCK_IN' | 'ISSUE'>('STOCK_IN');
  const [packagingType, setPackagingType] = useState<PackagingType>('JUTE_BAG');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(profile?.assignedWarehouseId || '');

  const availableStock = selectedWarehouseId ? getWarehouseBagStock(selectedWarehouseId, packagingType) : 0;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const quantity = Number(formData.get('quantity'));

    if (bagOpType === 'ISSUE' && quantity > availableStock) {
      alert(`Insufficient stock. Only ${availableStock} units available.`);
      return;
    }
    
    const data = {
      type: bagOpType,
      packagingType,
      quantity,
      reference: formData.get('reference'),
      warehouseId: selectedWarehouseId,
      supplierId: formData.get('supplierId')
    };
    
    onSubmit(data);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold">New Bag Transaction</h2>
        <button onClick={onCancel} className="text-slate-400">Cancel</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Transaction Type</label>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setBagOpType('STOCK_IN')}
                className={cn(
                  "flex-1 py-2 rounded-lg text-xs font-bold transition-all",
                  bagOpType === 'STOCK_IN' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                )}
              >
                Stock-In
              </button>
              <button
                type="button"
                onClick={() => setBagOpType('ISSUE')}
                className={cn(
                  "flex-1 py-2 rounded-lg text-xs font-bold transition-all",
                  bagOpType === 'ISSUE' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                )}
              >
                Issuance
              </button>
            </div>
          </div>
          <div className="col-span-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Warehouse</label>
            <select 
              name="warehouseId" 
              required 
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              disabled={!!profile?.assignedWarehouseId && profile?.role === 'STAFF'}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none disabled:opacity-50"
            >
              <option value="">Select Warehouse</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          {selectedWarehouseId && (
            <div className="col-span-2 bg-amber-50 p-3 rounded-xl border border-amber-100 mb-2">
              <p className="text-[10px] font-bold text-amber-600 uppercase mb-1">Available {packagingType.replace('_', ' ')}</p>
              <p className="text-lg font-black text-amber-700">
                {availableStock.toLocaleString()} units
              </p>
            </div>
          )}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bag Type</label>
            <select 
              value={packagingType} 
              onChange={(e) => setPackagingType(e.target.value as PackagingType)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
            >
              {PACKAGING.map(p => <option key={p} value={p}>{p.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Quantity (Units)</label>
            <input 
              name="quantity" 
              type="number" 
              required 
              max={bagOpType === 'ISSUE' ? availableStock : undefined}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" 
              placeholder="0" 
            />
            {bagOpType === 'ISSUE' && (
              <p className="text-[10px] text-slate-400 mt-1">Available: {availableStock.toLocaleString()} units</p>
            )}
          </div>

          {bagOpType === 'ISSUE' && (
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Supplier (Required for Issuance)</label>
              <select name="supplierId" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none">
                <option value="">Select Supplier</option>
                {suppliers.filter(s => !s.isDeleted).map(s => <option key={s.id} value={s.id}>{s.name} ({s.location})</option>)}
              </select>
            </div>
          )}

          <div className="col-span-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Reference (Optional)</label>
            <input name="reference" type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="e.g. Batch # or Waybill" />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-amber-600 text-white py-4 rounded-xl font-bold shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Recording...' : `Confirm ${bagOpType === 'STOCK_IN' ? 'Stock-In' : 'Issuance'}`}
        </button>
      </form>
    </motion.div>
  );
}
