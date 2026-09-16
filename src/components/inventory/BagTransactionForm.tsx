/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import type { PackagingType, Supplier, Warehouse } from '../../types';
import { cn, formatNumber, toNumber } from '../../lib/utils';

export interface BagTransactionInput {
  type: 'STOCK_IN' | 'ISSUE' | 'RETURN';
  packagingType: PackagingType;
  quantity: number;
  reference: string;
  warehouseId: string;
  supplierId?: string;
}

interface BagTransactionFormProps {
  suppliers: Supplier[];
  warehouses: Warehouse[];
  available: (warehouseId: string, pkg: PackagingType) => number;
  defaultWarehouseId: string;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (input: BagTransactionInput) => void;
}

const PACKAGING: PackagingType[] = ['JUTE_BAG', 'NYLON_BAG'];
const fieldClass = 'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none';
const TYPES = [
  { id: 'STOCK_IN' as const, label: 'Stock in' },
  { id: 'ISSUE' as const, label: 'Issue to supplier' },
  { id: 'RETURN' as const, label: 'Return from supplier' },
];

export default function BagTransactionForm({ suppliers, warehouses, available, defaultWarehouseId, submitting, onCancel, onSubmit }: BagTransactionFormProps) {
  const [type, setType] = useState<BagTransactionInput['type']>('STOCK_IN');
  const [packagingType, setPackagingType] = useState<PackagingType>('JUTE_BAG');
  const [warehouseId, setWarehouseId] = useState(defaultWarehouseId);
  const [supplierId, setSupplierId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const stock = warehouseId ? available(warehouseId, packagingType) : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const qty = Math.round(toNumber(quantity));
    if (!warehouseId) return setError('Select a warehouse.');
    if (qty <= 0) return setError('Quantity must be at least 1.');
    if (type !== 'STOCK_IN' && !supplierId) return setError('Select the supplier.');
    if (type === 'ISSUE' && qty > stock) return setError(`Only ${formatNumber(stock, 0)} bags are available.`);
    onSubmit({ type, packagingType, quantity: qty, reference: reference.trim(), warehouseId, supplierId: type === 'STOCK_IN' ? undefined : supplierId });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold">Bag movement</h2>
        <button type="button" onClick={onCancel} className="text-slate-400">Cancel</button>
      </div>
      {error && <p className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl p-3" role="alert">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex bg-slate-100 p-1 rounded-xl">
          {TYPES.map(t => (
            <button key={t.id} type="button" onClick={() => setType(t.id)} className={cn('flex-1 py-2 rounded-lg text-xs font-bold', type === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Warehouse</span>
            <select required value={warehouseId} onChange={e => setWarehouseId(e.target.value)} className={fieldClass}>
              <option value="">Select warehouse</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bag type</span>
            <select value={packagingType} onChange={e => setPackagingType(e.target.value as PackagingType)} className={fieldClass}>
              {PACKAGING.map(p => <option key={p} value={p}>{p.replace('_', ' ')}</option>)}
            </select>
          </label>
        </div>
        {warehouseId && (
          <div className="bg-amber-50 p-3 rounded-xl border border-amber-100">
            <p className="text-[10px] font-bold text-amber-600 uppercase mb-1">In stock</p>
            <p className="text-lg font-black text-amber-700">{formatNumber(stock, 0)} bags</p>
          </div>
        )}
        {type !== 'STOCK_IN' && (
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Supplier</span>
            <select required value={supplierId} onChange={e => setSupplierId(e.target.value)} className={fieldClass}>
              <option value="">Select supplier</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}{s.location ? ` (${s.location})` : ''}</option>)}
            </select>
          </label>
        )}
        <label className="block">
          <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Quantity</span>
          <input required type="number" min={1} step={1} value={quantity} onChange={e => setQuantity(e.target.value)} className={fieldClass} />
        </label>
        <label className="block">
          <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Reference</span>
          <input maxLength={60} value={reference} onChange={e => setReference(e.target.value)} className={fieldClass} placeholder="e.g. waybill number (optional)" />
        </label>
        <button type="submit" disabled={submitting} className="w-full bg-amber-600 text-white py-4 rounded-xl font-bold shadow-xl disabled:opacity-50">
          {submitting ? 'Recording…' : 'Confirm'}
        </button>
      </form>
    </motion.div>
  );
}
