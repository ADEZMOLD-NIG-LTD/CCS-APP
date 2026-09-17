/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import type { Warehouse } from '../../types';
import { todayLocal } from '../../lib/dates';
import { formatWeight, roundWeight, toNumber, WEIGHT_DECIMALS } from '../../lib/utils';
import { DigitFormattedInput } from '../DigitFormattedInput';
import CommodityPicker from './CommodityPicker';

export interface StockTransferInput {
  commodity: string;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  weight: number;
  bags: number;
  date: string;
}

interface StockTransferFormProps {
  warehouses: Warehouse[];
  available: (warehouseId: string, commodity: string) => number;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (input: StockTransferInput) => void;
}

const fieldClass = 'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500';

export default function StockTransferForm({ warehouses, available, submitting, onCancel, onSubmit }: StockTransferFormProps) {
  const [commodity, setCommodity] = useState('COCOA');
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [weight, setWeight] = useState('');
  const [bags, setBags] = useState('');
  const [date, setDate] = useState(todayLocal());
  const [error, setError] = useState<string | null>(null);
  const availableKg = source ? available(source, commodity) : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const kg = toNumber(weight);
    if (!source || !destination) return setError('Select both warehouses.');
    if (source === destination) return setError('Source and destination must be different.');
    if (kg <= 0) return setError('Weight must be greater than zero.');
    if (kg > availableKg) return setError(`Only ${formatWeight(availableKg)}kg is available at the source.`);
    onSubmit({ commodity, sourceWarehouseId: source, destinationWarehouseId: destination, weight: roundWeight(kg), bags: Math.max(0, Math.round(toNumber(bags))), date });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold">Stock transfer</h2>
        <button type="button" onClick={onCancel} className="text-slate-400">Cancel</button>
      </div>
      {error && <p className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl p-3" role="alert">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <label className="col-span-2 block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Commodity</span>
            <CommodityPicker value={commodity} onChange={setCommodity} className={fieldClass} />
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">From</span>
            <select required value={source} onChange={e => setSource(e.target.value)} className={fieldClass}>
              <option value="">Source</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">To</span>
            <select required value={destination} onChange={e => setDestination(e.target.value)} className={fieldClass}>
              <option value="">Destination</option>
              {warehouses.filter(w => w.id !== source).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
          {source && (
            <div className="col-span-2 bg-indigo-50 p-3 rounded-xl border border-indigo-100">
              <p className="text-[10px] font-bold text-indigo-600 uppercase mb-1">Available at source</p>
              <p className="text-lg font-black text-indigo-700 tabular-nums break-words">{formatWeight(availableKg)} kg</p>
            </div>
          )}
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Weight</span>
            <DigitFormattedInput required value={weight} onChange={setWeight} decimals={WEIGHT_DECIMALS} className={fieldClass} suffix="kg" />
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bags</span>
            <DigitFormattedInput value={bags} onChange={setBags} decimals={0} className={fieldClass} suffix="bags" />
          </label>
          <label className="col-span-2 block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Date</span>
            <input type="date" required max={todayLocal()} value={date} onChange={e => setDate(e.target.value)} className={fieldClass} />
          </label>
        </div>
        <button type="submit" disabled={submitting} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold shadow-xl disabled:opacity-50">
          {submitting ? 'Transferring…' : 'Complete transfer'}
        </button>
      </form>
    </motion.div>
  );
}
