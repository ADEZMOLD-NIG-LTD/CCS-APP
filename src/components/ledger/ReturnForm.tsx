/**
 * Purchase return (goods sent back to a supplier) or sales return (goods received back from a buyer).
 */

import React, { useState } from 'react';
import type { Warehouse } from '../../types';
import { todayLocal } from '../../lib/dates';
import { formatCurrency, formatWeight, roundTo, roundWeight, toNumber, WEIGHT_DECIMALS } from '../../lib/utils';
import { DigitFormattedInput } from '../DigitFormattedInput';
import CommodityPicker from '../inventory/CommodityPicker';

export interface ReturnInput {
  date: string;
  warehouseId: string;
  commodity: string;
  bags: number;
  grossWeight: number;
  netWeight: number;
  pricePerKg: number;
  totalValue: number;
  referenceId: string;
  notes: string;
}

interface ReturnFormProps {
  kind: 'PURCHASE_RETURN' | 'SALES_RETURN';
  warehouses: Warehouse[];
  /** Stock available for a purchase return (goods leave the warehouse). */
  available?: (warehouseId: string, commodity: string) => number;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (input: ReturnInput) => void;
}

const field = 'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium';

export default function ReturnForm({ kind, warehouses, available, busy, onCancel, onSubmit }: ReturnFormProps) {
  const [date, setDate] = useState(todayLocal());
  const [warehouseId, setWarehouseId] = useState('');
  const [commodity, setCommodity] = useState('COCOA');
  const [bags, setBags] = useState('');
  const [gross, setGross] = useState('');
  const [net, setNet] = useState('');
  const [price, setPrice] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const total = roundTo(toNumber(net) * toNumber(price), 2);
  const stock = kind === 'PURCHASE_RETURN' && available && warehouseId ? available(warehouseId, commodity) : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const grossWeight = roundWeight(toNumber(gross));
    const netWeight = roundWeight(toNumber(net));
    if (!warehouseId) return setError('Select a warehouse.');
    if (grossWeight <= 0 || netWeight <= 0) return setError('Weights must be greater than zero.');
    if (netWeight > grossWeight) return setError('Net weight cannot exceed gross weight.');
    if (toNumber(price) <= 0) return setError('Price per kg must be greater than zero.');
    if (stock !== null && netWeight > stock) return setError(`Only ${formatWeight(stock)}kg is in stock at this warehouse.`);
    if (!notes.trim()) return setError('Give a reason for the return.');
    onSubmit({
      date, warehouseId, commodity, bags: Math.max(0, Math.round(toNumber(bags))), grossWeight, netWeight,
      pricePerKg: roundTo(toNumber(price), 2), totalValue: total, referenceId: referenceId.trim(), notes: notes.trim(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl my-auto" role="dialog" aria-label="Record return">
        <h2 className="text-xl font-bold mb-6 text-rose-600">{kind === 'PURCHASE_RETURN' ? 'Purchase return' : 'Sales return'}</h2>
        {error && <p className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl p-3" role="alert">{error}</p>}
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Date</span>
            <input type="date" required max={todayLocal()} value={date} onChange={e => setDate(e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Warehouse</span>
            <select required value={warehouseId} onChange={e => setWarehouseId(e.target.value)} className={field}>
              <option value="">Select warehouse</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            {stock !== null && <span className="block text-[10px] text-slate-500 mt-1">In stock: {formatWeight(stock)}kg</span>}
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Commodity</span>
            <CommodityPicker value={commodity} onChange={setCommodity} className={field} />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bags</span>
              <DigitFormattedInput value={bags} onChange={setBags} decimals={0} className={field} />
            </label>
            <label className="block">
              <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Gross weight</span>
              <DigitFormattedInput required value={gross} onChange={setGross} decimals={WEIGHT_DECIMALS} className={field} suffix="kg" />
            </label>
            <label className="block">
              <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Net weight</span>
              <DigitFormattedInput required value={net} onChange={setNet} decimals={WEIGHT_DECIMALS} className={field} suffix="kg" />
            </label>
            <label className="block">
              <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Price per kg</span>
              <DigitFormattedInput required value={price} onChange={setPrice} className={field} prefix="₦" />
            </label>
          </div>
          <p className="text-sm font-black text-rose-700 bg-rose-50 rounded-xl p-3">Return value: {formatCurrency(total)}</p>
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Reference (optional)</span>
            <input maxLength={60} value={referenceId} onChange={e => setReferenceId(e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Reason</span>
            <input required maxLength={300} value={notes} onChange={e => setNotes(e.target.value)} className={field} />
          </label>
          <div className="flex gap-3 mt-6">
            <button type="button" onClick={onCancel} className="flex-1 py-4 text-slate-500 font-bold text-sm">Cancel</button>
            <button type="submit" disabled={busy} className="flex-1 bg-rose-600 text-white py-4 rounded-xl font-bold shadow-lg disabled:opacity-50 text-sm">
              {busy ? 'Recording…' : 'Record return'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
