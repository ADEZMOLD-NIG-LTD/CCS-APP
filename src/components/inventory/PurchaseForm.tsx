/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Calculator } from 'lucide-react';
import { motion } from 'motion/react';
import type { CalculationMethod, DeductionParams, Supplier, Transaction, Warehouse } from '../../types';
import { benchmarkFor, computeNetWeight } from '../../lib/finance';
import { isoToLocalDate, todayLocal } from '../../lib/dates';
import { cn, formatCurrency, formatNumber, roundTo, toNumber } from '../../lib/utils';
import { DigitFormattedInput } from '../DigitFormattedInput';
import CommodityPicker from './CommodityPicker';

export interface PurchaseInput {
  commodity: string;
  calculationMethod: CalculationMethod;
  date: string;
  warehouseId: string;
  supplierId?: string;
  isWalkIn: boolean;
  storeRecordId: string;
  grossWeight: number;
  netWeight: number;
  bags: number;
  pricePerKg: number;
  totalValue: number;
  deductions: DeductionParams;
}

interface PurchaseFormProps {
  suppliers: Supplier[];
  warehouses: Warehouse[];
  defaultWarehouseId: string;
  editingTransaction: Transaction | null;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (input: PurchaseInput) => void;
}

const fieldClass = 'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm';

export default function PurchaseForm({ suppliers, warehouses, defaultWarehouseId, editingTransaction: tx, submitting, onCancel, onSubmit }: PurchaseFormProps) {
  const [commodity, setCommodity] = useState(tx?.commodity ?? 'COCOA');
  const [method, setMethod] = useState<CalculationMethod>(tx?.calculationMethod ?? 'DIRECT');
  const [date, setDate] = useState(tx ? isoToLocalDate(tx.date) || todayLocal() : todayLocal());
  const [warehouseId, setWarehouseId] = useState(tx?.warehouseId ?? defaultWarehouseId);
  const [isWalkIn, setIsWalkIn] = useState(!!tx?.supplierId?.startsWith('WALK_IN_'));
  const [supplierId, setSupplierId] = useState(tx?.supplierId?.startsWith('WALK_IN_') ? '' : tx?.supplierId ?? '');
  const [storeRecordId, setStoreRecordId] = useState(tx?.storeRecordId ?? '');
  const [gross, setGross] = useState(String(tx?.grossWeight ?? ''));
  const [bags, setBags] = useState(String(tx?.noOfBags ?? tx?.bags ?? ''));
  const [price, setPrice] = useState(String(tx?.pricePerKg ?? ''));
  const [moistureActual, setMoistureActual] = useState(String(tx?.deductions?.moistureActual ?? benchmarkFor(commodity)));
  const [moistureBenchmark, setMoistureBenchmark] = useState(String(tx?.deductions?.moistureBenchmark ?? benchmarkFor(commodity)));
  const [tare, setTare] = useState(String(tx?.deductions?.tareWeight ?? ''));
  const [mold, setMold] = useState(String(tx?.deductions?.moldWeight ?? ''));
  const [other, setOther] = useState(String(tx?.deductions?.otherDeduction ?? ''));
  const [manualNet, setManualNet] = useState(String(tx?.calculationMethod === 'MANUAL' ? tx.netWeight : ''));
  const [manualTotal, setManualTotal] = useState(String(tx?.calculationMethod === 'MANUAL' ? tx.totalValue ?? '' : ''));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tx) {
      setMoistureBenchmark(String(benchmarkFor(commodity)));
      setMoistureActual(String(benchmarkFor(commodity)));
    }
  }, [commodity, tx]);

  const calc = useMemo(() => computeNetWeight({
    grossWeight: gross, moistureActual, moistureBenchmark, tareWeight: tare, moldWeight: mold, otherDeduction: other,
  }), [gross, moistureActual, moistureBenchmark, tare, mold, other]);

  const netWeight = method === 'MANUAL' ? toNumber(manualNet) : calc.netWeight;
  const totalValue = method === 'MANUAL' ? toNumber(manualTotal) : roundTo(calc.netWeight * toNumber(price), 2);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const grossWeight = toNumber(gross);
    const pricePerKg = toNumber(price);
    if (!warehouseId) return setError('Select a warehouse.');
    if (!isWalkIn && !supplierId) return setError('Select a supplier or mark this as a walk-in purchase.');
    if (!commodity) return setError('Enter the commodity.');
    if (grossWeight <= 0) return setError('Gross weight must be greater than zero.');
    if (pricePerKg <= 0 && method === 'DIRECT') return setError('Price per kg must be greater than zero.');
    if (netWeight <= 0) return setError('Net weight must be greater than zero.');
    if (netWeight > grossWeight) return setError('Net weight cannot be more than gross weight.');
    if (totalValue <= 0) return setError('Total value must be greater than zero.');
    onSubmit({
      commodity,
      calculationMethod: method,
      date,
      warehouseId,
      supplierId: isWalkIn ? undefined : supplierId,
      isWalkIn,
      storeRecordId: storeRecordId.trim(),
      grossWeight: roundTo(grossWeight, 2),
      netWeight: roundTo(netWeight, 2),
      bags: Math.max(0, Math.round(toNumber(bags))),
      pricePerKg: method === 'MANUAL' && pricePerKg <= 0 ? roundTo(totalValue / netWeight, 2) : roundTo(pricePerKg, 2),
      totalValue: roundTo(totalValue, 2),
      deductions: {
        moistureActual: toNumber(moistureActual),
        moistureBenchmark: toNumber(moistureBenchmark),
        tareWeight: Math.max(0, toNumber(tare)),
        moldWeight: Math.max(0, toNumber(mold)),
        otherDeduction: Math.max(0, toNumber(other)),
      },
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="google-card p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold">{tx ? 'Adjust purchase' : 'New purchase'}</h2>
        <button type="button" onClick={onCancel} className="text-slate-400">Cancel</button>
      </div>

      {error && <p className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl p-3" role="alert">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Warehouse</span>
            <select required value={warehouseId} onChange={e => setWarehouseId(e.target.value)} className={fieldClass}>
              <option value="" disabled>Select warehouse</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Date</span>
            <input type="date" required max={todayLocal()} value={date} onChange={e => setDate(e.target.value)} className={fieldClass} />
          </label>

          <div className="col-span-2">
            <div className="flex justify-between items-center mb-1">
              <span className="block text-[10px] font-bold text-slate-400 uppercase">Supplier</span>
              <label className="flex items-center gap-2 cursor-pointer text-[10px] font-bold text-emerald-700 uppercase">
                <input type="checkbox" checked={isWalkIn} onChange={e => setIsWalkIn(e.target.checked)} className="w-4 h-4 accent-emerald-600" /> Walk-in
              </label>
            </div>
            {isWalkIn ? (
              <div className="w-full px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800 font-medium">Walk-in supplier (general)</div>
            ) : (
              <select required value={supplierId} onChange={e => setSupplierId(e.target.value)} className={fieldClass}>
                <option value="">Select supplier</option>
                {suppliers.filter(s => !s.id.startsWith('WALK_IN_')).map(s => <option key={s.id} value={s.id}>{s.name}{s.location ? ` (${s.location})` : ''}</option>)}
              </select>
            )}
          </div>

          <label className="block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Commodity</span>
            <CommodityPicker value={commodity} onChange={setCommodity} className={fieldClass} />
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Store record ID</span>
            <input value={storeRecordId} maxLength={60} onChange={e => setStoreRecordId(e.target.value)} className={fieldClass} placeholder="Optional" />
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Calculation</span>
            <select value={method} onChange={e => setMethod(e.target.value as CalculationMethod)} className={cn(fieldClass, 'font-bold text-indigo-700')}>
              <option value="DIRECT">Automatic</option>
              <option value="MANUAL">Manual figures</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bags</span>
            <DigitFormattedInput value={bags} onChange={setBags} decimals={0} className={fieldClass} suffix="bags" />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Gross weight (kg)</span>
            <DigitFormattedInput required value={gross} onChange={setGross} className={cn(fieldClass, 'font-bold text-lg')} suffix="kg" />
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Price per kg</span>
            <DigitFormattedInput required={method === 'DIRECT'} value={price} onChange={setPrice} className={cn(fieldClass, 'font-bold text-lg')} prefix="₦" />
          </label>
        </div>

        {method === 'DIRECT' && (
          <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 space-y-4">
            <h3 className="text-xs font-bold text-emerald-800 flex items-center gap-2"><Calculator size={14} /> Deductions</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                ['Moisture actual (%)', moistureActual, setMoistureActual],
                ['Benchmark (%)', moistureBenchmark, setMoistureBenchmark],
                ['Tare (kg)', tare, setTare],
                ['Mould (kg)', mold, setMold],
                ['Other (kg)', other, setOther],
              ].map(([label, value, setter]) => (
                <label key={label as string} className="block">
                  <span className="block text-[9px] font-bold text-emerald-700 uppercase mb-1">{label as string}</span>
                  <input type="number" min="0" step="0.1" value={value as string} onChange={e => (setter as (v: string) => void)(e.target.value)} className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-lg text-sm" />
                </label>
              ))}
            </div>
            <p className="text-[10px] text-emerald-700">Moisture loss is only deducted when the actual moisture is above the benchmark. Moisture loss: {formatNumber(calc.moistureLoss)}kg · total deductions: {formatNumber(calc.totalDeductions)}kg</p>
          </div>
        )}

        <div className={cn('rounded-2xl p-6 text-white shadow-xl', method === 'MANUAL' ? 'bg-indigo-600' : 'bg-emerald-600')}>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-[10px] uppercase font-bold opacity-80 mb-2">Net weight</p>
              {method === 'MANUAL' ? (
                <DigitFormattedInput value={manualNet} onChange={setManualNet} className="w-full bg-white/20 border border-white/30 rounded-lg px-3 py-2 text-xl font-black outline-none text-white" suffix="kg" />
              ) : (
                <p className="text-3xl font-black">{formatNumber(netWeight)} <span className="text-sm font-normal">kg</span></p>
              )}
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold opacity-80 mb-2">Total value</p>
              {method === 'MANUAL' ? (
                <DigitFormattedInput value={manualTotal} onChange={setManualTotal} className="w-full bg-white/20 border border-white/30 rounded-lg pl-8 pr-3 py-2 text-xl font-black outline-none text-white" prefix="₦" />
              ) : (
                <p className="text-3xl font-black">{formatCurrency(totalValue)}</p>
              )}
            </div>
          </div>
        </div>

        <button type="submit" disabled={submitting} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold shadow-xl disabled:opacity-50">
          {submitting ? 'Saving…' : tx ? 'Save changes' : 'Record purchase'}
        </button>
      </form>
    </motion.div>
  );
}
