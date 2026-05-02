/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowLeftRight, X } from 'lucide-react';
import { motion } from 'motion/react';
import { PackagingType, Warehouse } from '../../types';
import { formatNumber } from '../../lib/utils';

const PACKAGING: PackagingType[] = ['JUTE_BAG', 'NYLON_BAG'];

interface BagTransferFormProps {
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  warehouses: Warehouse[];
  getWarehouseBagStock: (warehouseId: string, pkgType: PackagingType) => number;
  submitting: boolean;
}

export default function BagTransferForm({
  onSubmit,
  onCancel,
  warehouses,
  getWarehouseBagStock,
  submitting
}: BagTransferFormProps) {
  const [transferBagType, setTransferBagType] = useState<PackagingType>('JUTE_BAG');
  const [transferBagSourceId, setTransferBagSourceId] = useState<string>('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const quantity = Number(formData.get('quantity'));
    const sourceId = formData.get('sourceWarehouseId') as string;

    const available = getWarehouseBagStock(sourceId, transferBagType);
    if (quantity > available) {
      alert(`Insufficient stock. Only ${available} units available in source.`);
      return;
    }
    
    const data = {
      sourceWarehouseId: sourceId,
      destinationWarehouseId: formData.get('destinationWarehouseId'),
      packagingType: transferBagType,
      quantity,
      reference: formData.get('reference')
    };
    
    onSubmit(data);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-3xl p-6 shadow-xl border border-slate-200"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
          <ArrowLeftRight className="text-amber-600" /> Bag Transfer
        </h2>
        <button onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <X size={20} className="text-slate-400" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bag Type</label>
            <select 
              name="packagingType" 
              required 
              value={transferBagType}
              onChange={(e) => setTransferBagType(e.target.value as PackagingType)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
            >
              {PACKAGING.map(p => <option key={p} value={p}>{p.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">From Warehouse</label>
            <select 
              name="sourceWarehouseId" 
              required 
              value={transferBagSourceId}
              onChange={(e) => setTransferBagSourceId(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
            >
              <option value="">Select Source</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          {transferBagSourceId && (
            <div className="col-span-2 bg-amber-50 p-3 rounded-xl border border-amber-100">
              <p className="text-[10px] font-bold text-amber-600 uppercase mb-1">Available Stock in Source</p>
              <p className="text-lg font-black text-amber-700">
                {formatNumber(getWarehouseBagStock(transferBagSourceId, transferBagType) || 0, 0)} units
              </p>
            </div>
          )}
          <div className="col-span-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">To Warehouse</label>
            <select name="destinationWarehouseId" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none">
              <option value="">Select Destination</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Quantity (Units)</label>
            <input 
              name="quantity" 
              type="number" 
              required 
              max={getWarehouseBagStock(transferBagSourceId, transferBagType) || 0}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" 
              placeholder="0" 
            />
          </div>
          <div className="col-span-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Reference (Optional)</label>
            <input name="reference" type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="e.g. Transfer ID" />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-amber-600 text-white py-4 rounded-xl font-bold shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Processing...' : 'Confirm Transfer'}
        </button>
      </form>
    </motion.div>
  );
}
