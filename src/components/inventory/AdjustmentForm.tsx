/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { AdjustmentTypeValue, InventoryAdjustment, Warehouse } from '../../types';
import { isoToLocalDate, todayLocal } from '../../lib/dates';
import { formatNumber, roundTo, toNumber } from '../../lib/utils';
import { DigitFormattedInput } from '../DigitFormattedInput';
import CommodityPicker from './CommodityPicker';

export interface AdjustmentInput {
  date: string;
  commodity: string;
  warehouseId: string;
  adjustmentType: AdjustmentTypeValue;
  adjustmentDirection: 'ADD' | 'REMOVE';
  netWeight: number;
  bags: number;
  notes: string;
}

interface AdjustmentFormProps {
  warehouses: Warehouse[];
  available: (warehouseId: string, commodity: string) => number;
  defaultWarehouseId: string;
  editingAdjustment: InventoryAdjustment | null;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (input: AdjustmentInput) => void;
}

const ADJUSTMENT_TYPES: { value: AdjustmentTypeValue; label: string }[] = [
  { value: 'WEIGHT_LOSS', label: 'Weight loss (moisture / shrinkage)' },
  { value: 'DAMAGED_STOCK', label: 'Damaged stock' },
  { value: 'SPOILAGE', label: 'Spoilage' },
  { value: 'THEFT_LOSS', label: 'Theft / loss' },
  { value: 'STOCK_COUNT', label: 'Stock count correction' },
  { value: 'QUALITY_TEST', label: 'Quality test consumption' },
  { value: 'INTERNAL_USE', label: 'Internal use' },
];

export default function AdjustmentForm({ warehouses, available, defaultWarehouseId, editingAdjustment: adj, submitting, onCancel, onSubmit }: AdjustmentFormProps) {
  const [date, setDate] = useState(adj ? isoToLocalDate(adj.date) || todayLocal() : todayLocal());
  const [commodity, setCommodity] = useState(adj?.commodity ?? 'COCOA');
  const [warehouseId, setWarehouseId] = useState(adj?.warehouseId ?? (defaultWarehouseId || warehouses[0]?.id || ''));
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentTypeValue>(adj?.adjustmentType ?? 'WEIGHT_LOSS');
  const [direction, setDirection] = useState<'ADD' | 'REMOVE'>(adj?.adjustmentDirection ?? 'REMOVE');
  const [netWeight, setNetWeight] = useState(String(adj?.netWeight ?? ''));
  const [bags, setBags] = useState(String(adj?.bags ?? ''));
  const [notes, setNotes] = useState(adj?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (adjustmentType !== 'STOCK_COUNT') setDirection('REMOVE');
  }, [adjustmentType]);

  // When editing, the adjustment's own effect is already in the current stock figure.
  const currentStock = warehouseId ? available(warehouseId, commodity) : 0;
  const ownEffect = adj && adj.warehouseId === warehouseId && adj.commodity === commodity ? (adj.adjustmentDirection === 'REMOVE' ? adj.netWeight : -adj.netWeight) : 0;
  const removable = roundTo(currentStock + ownEffect, 2);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const kg = roundTo(toNumber(netWeight), 2);
    if (!warehouseId) return setError('Select a warehouse.');
    if (kg <= 0) return setError('Weight must be greater than zero.');
    if (direction === 'REMOVE' && kg > removable) return setError(`Only ${formatNumber(removable)}kg is in stock.`);
    if (!notes.trim()) return setError('Explain the reason for this adjustment.');
    onSubmit({ date, commodity, warehouseId, adjustmentType, adjustmentDirection: direction, netWeight: kg, bags: Math.max(0, Math.round(toNumber(bags))), notes: notes.trim() });
  };

  return (
    <div className="bg-white rounded-3xl border border-[var(--border)] p-6 shadow-sm max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">{adj ? 'Edit adjustment' : 'New stock adjustment'}</h2>
          <p className="text-slate-500 text-xs">Record moisture shrinkage, damage, samples or count corrections.</p>
        </div>
        <button type="button" onClick={onCancel} className="text-slate-400">Cancel</button>
      </div>
      {error && <p className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl p-3" role="alert">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="google-label">Date</span>
            <input type="date" required max={todayLocal()} value={date} onChange={e => setDate(e.target.value)} className="google-input text-sm" />
          </label>
          <label className="block">
            <span className="google-label">Warehouse</span>
            <select required value={warehouseId} onChange={e => setWarehouseId(e.target.value)} className="google-input text-sm">
              <option value="">Choose warehouse</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="google-label">Commodity</span>
            <CommodityPicker value={commodity} onChange={setCommodity} className="google-input text-sm" />
          </label>
          <label className="block">
            <span className="google-label">Reason</span>
            <select value={adjustmentType} onChange={e => setAdjustmentType(e.target.value as AdjustmentTypeValue)} className="google-input text-sm">
              {ADJUSTMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
        </div>

        <div>
          <span className="google-label">Direction</span>
          <div className="grid grid-cols-2 gap-3">
            {(['ADD', 'REMOVE'] as const).map(dir => (
              <button key={dir} type="button" disabled={adjustmentType !== 'STOCK_COUNT'} onClick={() => setDirection(dir)}
                className={`py-3 px-4 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 ${direction === dir ? (dir === 'ADD' ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-rose-600 bg-rose-50 text-rose-700') : 'border-[var(--border)] bg-white text-slate-400'} disabled:cursor-not-allowed`}>
                {dir === 'ADD' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />} {dir === 'ADD' ? 'Add stock' : 'Remove stock'}
              </button>
            ))}
          </div>
          {adjustmentType !== 'STOCK_COUNT' && <p className="text-[10px] text-slate-400 mt-1">Only stock count corrections can add stock.</p>}
          {warehouseId && <p className="text-[10px] text-slate-500 mt-1">In stock: {formatNumber(removable)}kg</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="google-label">Weight (kg)</span>
            <DigitFormattedInput required value={netWeight} onChange={setNetWeight} className="google-input text-sm" suffix="kg" />
          </label>
          <label className="block">
            <span className="google-label">Bags</span>
            <DigitFormattedInput value={bags} onChange={setBags} decimals={0} className="google-input text-sm" suffix="bags" />
          </label>
        </div>

        <label className="block">
          <span className="google-label">Notes</span>
          <textarea required maxLength={1000} value={notes} onChange={e => setNotes(e.target.value)} className="google-input text-sm min-h-[90px] p-3" placeholder="What happened and who verified it" />
        </label>

        <div className="flex gap-3 pt-4 border-t border-[var(--border)]">
          <button type="button" onClick={onCancel} className="flex-1 google-btn-secondary text-sm font-bold py-3">Cancel</button>
          <button type="submit" disabled={submitting} className="flex-1 google-btn-primary text-sm font-bold py-3 disabled:opacity-50">
            {submitting ? 'Saving…' : adj ? 'Update adjustment' : 'Post adjustment'}
          </button>
        </div>
      </form>
    </div>
  );
}
