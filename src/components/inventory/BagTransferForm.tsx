/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowLeftRight, X } from 'lucide-react';
import { motion } from 'motion/react';
import type { PackagingType, Warehouse } from '../../types';
import { formatNumber, toNumber } from '../../lib/utils';

export interface BagTransferInput {
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  packagingType: PackagingType;
  quantity: number;
  reference: string;
}

interface BagTransferFormProps {
  warehouses: Warehouse[];
  available: (warehouseId: string, pkg: PackagingType) => number;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (input: BagTransferInput) => void;
}

const PACKAGING: PackagingType[] = ['JUTE_BAG', 'NYLON_BAG'];
const fieldClass = 'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none';

export default function BagTransferForm({ warehouses, available, submitting, onCancel, onSubmit }: BagTransferFormProps) {
  const [packagingType, setPackagingType] = useState<PackagingType>('JUTE_BAG');
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const stock = source ? available(source, packagingType) : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const qty = Math.round(toNumber(quantity));
    if (!source || !destination) return setError('Select both warehouses.');
    if (source === destination) return setError('Source and destination must be different.');
    if (qty <= 0) return setError('Quantity must be at least 1.');
    if (qty > stock) return setError(`Only ${formatNumber(stock, 0)} bags are available at the source.`);
    onSubmit({ sourceWarehouseId: source, destinationWarehouseId: destination, packagingType, quantity: qty, reference: reference.trim() });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="bg-white rounded-3xl p-6 shadow-xl border border-slate-200">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-black text-slate-900 flex items-center gap-2"><ArrowLeftRight className="text-amber-600" /> Bag transfer</h2>
        <button type="button" onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-full" aria-label="Cancel"><X size={20} className="text-slate-400" /></button>
      </div>
      {error && <p className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl p-3" role="alert">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block">
          <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bag type</span>
          <select value={packagingType} onChange={e => setPackagingType(e.target.value as PackagingType)} className={fieldClass}>
            {PACKAGING.map(p => <option key={p} value={p}>{p.replace('_', ' ')}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">From</span>
          <select required value={source} onChange={e => setSource(e.target.value)} className={fieldClass}>
            <option value="">Select source</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </label>
        {source && (
          <div className="bg-amber-50 p-3 rounded-xl border border-amber-100">
            <p className="text-[10px] font-bold text-amber-600 uppercase mb-1">Available at source</p>
            <p className="text-lg font-black text-amber-700">{formatNumber(stock, 0)} bags</p>
          </div>
        )}
        <label className="block">
          <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">To</span>
          <select required value={destination} onChange={e => setDestination(e.target.value)} className={fieldClass}>
            <option value="">Select destination</option>
            {warehouses.filter(w => w.id !== source).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Quantity</span>
          <input required type="number" min={1} step={1} value={quantity} onChange={e => setQuantity(e.target.value)} className={fieldClass} />
        </label>
        <label className="block">
          <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Reference</span>
          <input maxLength={60} value={reference} onChange={e => setReference(e.target.value)} className={fieldClass} placeholder="Optional" />
        </label>
        <button type="submit" disabled={submitting} className="w-full bg-amber-600 text-white py-4 rounded-xl font-bold shadow-xl disabled:opacity-50">
          {submitting ? 'Processing…' : 'Confirm transfer'}
        </button>
      </form>
    </motion.div>
  );
}
