/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { CommodityType, Warehouse } from '../../types';
import { formatNumber } from '../../lib/utils';

const COMMODITIES: CommodityType[] = ['COCOA', 'CASHEW', 'PK'];

interface StockTransferFormProps {
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  warehouses: Warehouse[];
  getWarehouseStock: (warehouseId: string, commodityType: CommodityType) => number;
  submitting: boolean;
}

export default function StockTransferForm({
  onSubmit,
  onCancel,
  warehouses,
  getWarehouseStock,
  submitting
}: StockTransferFormProps) {
  const [transferCommodity, setTransferCommodity] = useState<CommodityType>('COCOA');
  const [transferSourceId, setTransferSourceId] = useState<string>('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const data = {
      commodity: transferCommodity,
      sourceWarehouseId: formData.get('sourceWarehouseId'),
      destinationWarehouseId: formData.get('destinationWarehouseId'),
      weight: Number(formData.get('weight')),
      bags: Number(formData.get('bags'))
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
        <h2 className="text-lg font-bold">Stock Transfer</h2>
        <button onClick={onCancel} className="text-slate-400">Cancel</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Commodity</label>
            <select 
              name="commodity" 
              required 
              value={transferCommodity}
              onChange={(e) => setTransferCommodity(e.target.value as CommodityType)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {COMMODITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Source Warehouse</label>
            <select 
              name="sourceWarehouseId" 
              required 
              value={transferSourceId}
              onChange={(e) => setTransferSourceId(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Source</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Destination Warehouse</label>
            <select name="destinationWarehouseId" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Destination</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          {transferSourceId && (
            <div className="col-span-2 bg-indigo-50 p-3 rounded-xl border border-indigo-100">
              <p className="text-[10px] font-bold text-indigo-600 uppercase mb-1">Available Stock in Source</p>
              <p className="text-lg font-black text-indigo-700">
                {formatNumber(getWarehouseStock(transferSourceId, transferCommodity) || 0)} kg
              </p>
            </div>
          )}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Weight (kg)</label>
            <input name="weight" type="number" step="0.01" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0.00" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bags Count</label>
            <input name="bags" type="number" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0" />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting ? 'Transferring...' : 'Complete Transfer'}
        </button>
      </form>
    </motion.div>
  );
}
