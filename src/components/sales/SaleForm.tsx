/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, Truck, Users } from 'lucide-react';
import type { Buyer, CalculationMethod, DeductionParams, Supplier, Transaction, Warehouse } from '../../types';
import { benchmarkFor, computeNetWeight } from '../../lib/finance';
import { isoToLocalDate, todayLocal } from '../../lib/dates';
import { cn, formatCurrency, formatNumber, roundTo, toNumber } from '../../lib/utils';
import { DigitFormattedInput } from '../DigitFormattedInput';
import CommodityPicker from '../inventory/CommodityPicker';

export interface SaleInput {
  date: string;
  commodity: string;
  calculationMethod: CalculationMethod;
  isDirectDelivery: boolean;
  warehouseId: string;
  buyerId?: string;
  supplierId?: string;
  supplierPricePerKg?: number;
  supplierCreditValue?: number;
  storeRecordId: string;
  grossWeight: number;
  netWeight: number;
  bags: number;
  pricePerKg: number;
  totalValue: number;
  truckNo: string;
  driverName: string;
  driverPhone: string;
  staffName: string;
  notes: string;
  deductions: DeductionParams;
}

interface SaleFormProps {
  editingTransaction: Transaction | null;
  warehouses: Warehouse[];
  buyers: Buyer[];
  suppliers: Supplier[];
  defaultWarehouseId: string;
  defaultStaffName: string;
  available: (warehouseId: string, commodity: string) => number;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (input: SaleInput) => void;
}

const field = 'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm';

function Toggle({ on, onChange, label, description, icon: Icon, color }: { on: boolean; onChange: (v: boolean) => void; label: string; description: string; icon: typeof Truck; color: string }) {
  return (
    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-bold text-slate-700"><Icon size={18} className="text-slate-400" /> {label}</span>
        <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={cn('w-12 h-6 rounded-full relative', on ? color : 'bg-slate-300')}>
          <span className={cn('absolute top-1 w-4 h-4 bg-white rounded-full transition-all', on ? 'left-7' : 'left-1')} />
        </button>
      </div>
      <p className="text-[10px] text-slate-500 mt-2 leading-tight">{description}</p>
    </div>
  );
}

export default function SaleForm({ editingTransaction: tx, warehouses, buyers, suppliers, defaultWarehouseId, defaultStaffName, available, submitting, onCancel, onSubmit }: SaleFormProps) {
  const [isDirectDelivery, setIsDirectDelivery] = useState(!!tx?.isDirectDelivery);
  const [supplierAsBuyer, setSupplierAsBuyer] = useState(!!tx && !tx.buyerId && !!tx.supplierId && !tx.isDirectDelivery);
  const [date, setDate] = useState(tx ? isoToLocalDate(tx.date) || todayLocal() : todayLocal());
  const [warehouseId, setWarehouseId] = useState(tx?.warehouseId ?? defaultWarehouseId);
  const [buyerId, setBuyerId] = useState(tx?.buyerId ?? '');
  const [supplierId, setSupplierId] = useState(tx?.supplierId ?? '');
  const [supplierPrice, setSupplierPrice] = useState(String(tx?.supplierPricePerKg ?? ''));
  const [commodity, setCommodity] = useState(tx?.commodity ?? 'COCOA');
  const [method, setMethod] = useState<CalculationMethod>(tx?.calculationMethod ?? 'DIRECT');
  const [bags, setBags] = useState(String(tx?.noOfBags ?? tx?.bags ?? ''));
  const [gross, setGross] = useState(String(tx?.grossWeight ?? ''));
  const [price, setPrice] = useState(String(tx?.pricePerKg ?? ''));
  const [moistureActual, setMoistureActual] = useState(String(tx?.deductions?.moistureActual ?? benchmarkFor(commodity)));
  const [moistureBenchmark, setMoistureBenchmark] = useState(String(tx?.deductions?.moistureBenchmark ?? benchmarkFor(commodity)));
  const [tare, setTare] = useState(String(tx?.deductions?.tareWeight ?? ''));
  const [mold, setMold] = useState(String(tx?.deductions?.moldWeight ?? ''));
  const [other, setOther] = useState(String(tx?.deductions?.otherDeduction ?? ''));
  const [manualNet, setManualNet] = useState(String(tx?.calculationMethod === 'MANUAL' ? tx.netWeight : ''));
  const [manualTotal, setManualTotal] = useState(String(tx?.calculationMethod === 'MANUAL' ? tx.totalValue ?? '' : ''));
  const [storeRecordId, setStoreRecordId] = useState(tx?.storeRecordId ?? '');
  const [truckNo, setTruckNo] = useState(tx?.truckNo ?? '');
  const [driverName, setDriverName] = useState(tx?.driverName ?? '');
  const [driverPhone, setDriverPhone] = useState(tx?.driverPhone ?? '');
  const [staffName, setStaffName] = useState(tx?.staffName ?? defaultStaffName);
  const [notes, setNotes] = useState(tx?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tx) {
      setMoistureBenchmark(String(benchmarkFor(commodity)));
      setMoistureActual(String(benchmarkFor(commodity)));
    }
  }, [commodity, tx]);

  const calc = useMemo(() => computeNetWeight({ grossWeight: gross, moistureActual, moistureBenchmark, tareWeight: tare, moldWeight: mold, otherDeduction: other }), [gross, moistureActual, moistureBenchmark, tare, mold, other]);
  const netWeight = method === 'MANUAL' ? toNumber(manualNet) : calc.netWeight;
  const totalValue = method === 'MANUAL' ? toNumber(manualTotal) : roundTo(calc.netWeight * toNumber(price), 2);

  // Stock available for this sale, adding back the original sale when editing.
  const stock = useMemo(() => {
    if (isDirectDelivery || !warehouseId) return null;
    let kg = available(warehouseId, commodity);
    if (tx && !tx.isDirectDelivery && tx.warehouseId === warehouseId && tx.commodity === commodity) kg += tx.netWeight;
    return roundTo(kg, 2);
  }, [isDirectDelivery, warehouseId, commodity, available, tx]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const grossWeight = roundTo(toNumber(gross), 2);
    if (!isDirectDelivery && !warehouseId) return setError('Select the warehouse the goods leave from.');
    if (supplierAsBuyer ? !supplierId : !buyerId) return setError(supplierAsBuyer ? 'Select the supplier who is buying.' : 'Select the buyer.');
    if (isDirectDelivery && !supplierId) return setError('Select the supplier delivering the goods.');
    if (grossWeight <= 0) return setError('Gross weight must be greater than zero.');
    if (netWeight <= 0) return setError('Net weight must be greater than zero.');
    if (netWeight > grossWeight) return setError('Net weight cannot exceed gross weight.');
    if (totalValue <= 0) return setError('Sale value must be greater than zero.');
    if (stock !== null && netWeight > stock) return setError(`Insufficient stock: only ${formatNumber(stock)}kg of ${commodity} at this warehouse.`);
    const supplierPricePerKg = isDirectDelivery ? roundTo(toNumber(supplierPrice), 2) : undefined;
    if (isDirectDelivery && (!supplierPricePerKg || supplierPricePerKg <= 0)) return setError('Enter the price per kg owed to the supplier.');

    onSubmit({
      date,
      commodity,
      calculationMethod: method,
      isDirectDelivery,
      warehouseId: isDirectDelivery ? '' : warehouseId,
      buyerId: supplierAsBuyer ? undefined : buyerId,
      supplierId: supplierAsBuyer || isDirectDelivery ? supplierId : undefined,
      supplierPricePerKg,
      supplierCreditValue: supplierPricePerKg ? roundTo(netWeight * supplierPricePerKg, 2) : undefined,
      storeRecordId: storeRecordId.trim(),
      grossWeight,
      netWeight: roundTo(netWeight, 2),
      bags: Math.max(0, Math.round(toNumber(bags))),
      pricePerKg: method === 'MANUAL' && toNumber(price) <= 0 ? roundTo(totalValue / netWeight, 2) : roundTo(toNumber(price), 2),
      totalValue: roundTo(totalValue, 2),
      truckNo: truckNo.trim(),
      driverName: driverName.trim(),
      driverPhone: driverPhone.trim(),
      staffName: staffName.trim(),
      notes: notes.trim(),
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
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold">{tx ? 'Adjust sale' : 'New sale'}</h2>
        <button type="button" onClick={onCancel} className="text-slate-400">Cancel</button>
      </div>
      {error && <p className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl p-3" role="alert">{error}</p>}

      <form onSubmit={submit} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Toggle on={isDirectDelivery} onChange={v => { setIsDirectDelivery(v); if (v) setSupplierAsBuyer(false); }} label="Direct delivery" color="bg-blue-600" icon={Truck}
            description="A supplier delivers straight to the buyer. No warehouse stock is used and the supplier is credited at the supplier price." />
          <Toggle on={supplierAsBuyer} onChange={v => { setSupplierAsBuyer(v); if (v) setIsDirectDelivery(false); }} label="Supplier is the buyer" color="bg-indigo-600" icon={Users}
            description="A registered supplier buys from you. The sale is charged to their supplier account." />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {!isDirectDelivery && (
            <label className="col-span-2 block">
              <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Warehouse</span>
              <select required value={warehouseId} onChange={e => setWarehouseId(e.target.value)} className={field}>
                <option value="">Select warehouse</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </label>
          )}
          {(isDirectDelivery || supplierAsBuyer) && (
            <label className="col-span-2 block">
              <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{isDirectDelivery ? 'Delivering supplier' : 'Buying supplier'}</span>
              <select required value={supplierId} onChange={e => setSupplierId(e.target.value)} className={field}>
                <option value="">Select supplier</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          )}
          {!supplierAsBuyer && (
            <label className="col-span-2 block">
              <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Buyer</span>
              <select required value={buyerId} onChange={e => setBuyerId(e.target.value)} className={field}>
                <option value="">Select buyer</option>
                {buyers.map(b => <option key={b.id} value={b.id}>{b.name}{b.location ? ` (${b.location})` : ''}</option>)}
              </select>
            </label>
          )}
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Store record ID</span>
            <input value={storeRecordId} maxLength={60} onChange={e => setStoreRecordId(e.target.value)} className={field} placeholder="Optional" />
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Date</span>
            <input type="date" required max={todayLocal()} value={date} onChange={e => setDate(e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Commodity</span>
            <CommodityPicker value={commodity} onChange={setCommodity} className={field} />
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Calculation</span>
            <select value={method} onChange={e => setMethod(e.target.value as CalculationMethod)} className={cn(field, 'font-bold text-indigo-700')}>
              <option value="DIRECT">Automatic</option>
              <option value="MANUAL">Manual figures</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bags</span>
            <DigitFormattedInput value={bags} onChange={setBags} decimals={0} className={field} suffix="bags" />
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Gross weight</span>
            <DigitFormattedInput required value={gross} onChange={setGross} className={cn(field, 'font-bold')} suffix="kg" />
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Selling price per kg</span>
            <DigitFormattedInput required={method === 'DIRECT'} value={price} onChange={setPrice} className={cn(field, 'font-bold')} prefix="₦" />
          </label>
          {isDirectDelivery && (
            <label className="block">
              <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Supplier price per kg</span>
              <DigitFormattedInput required value={supplierPrice} onChange={setSupplierPrice} className={cn(field, 'font-bold')} prefix="₦" />
            </label>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <input value={truckNo} maxLength={30} onChange={e => setTruckNo(e.target.value)} className={field} placeholder="Truck no." aria-label="Truck number" />
          <input value={staffName} maxLength={100} onChange={e => setStaffName(e.target.value)} className={field} placeholder="Staff name" aria-label="Staff name" />
          <input value={driverName} maxLength={100} onChange={e => setDriverName(e.target.value)} className={field} placeholder="Driver's name" aria-label="Driver name" />
          <input value={driverPhone} maxLength={30} onChange={e => setDriverPhone(e.target.value)} className={field} placeholder="Driver's phone" aria-label="Driver phone" />
          <textarea value={notes} maxLength={500} onChange={e => setNotes(e.target.value)} rows={2} className={cn(field, 'col-span-2 resize-none')} placeholder="Notes" aria-label="Notes" />
        </div>

        {method === 'DIRECT' && (
          <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 space-y-3">
            <h3 className="text-xs font-bold text-blue-800 flex items-center gap-2"><Calculator size={14} /> Deductions</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {([
                ['Moisture %', moistureActual, setMoistureActual],
                ['Benchmark %', moistureBenchmark, setMoistureBenchmark],
                ['Tare kg', tare, setTare],
                ['Mould kg', mold, setMold],
                ['Other kg', other, setOther],
              ] as const).map(([label, value, setter]) => (
                <label key={label} className="block">
                  <span className="block text-[9px] font-bold text-blue-700 uppercase mb-1">{label}</span>
                  <input type="number" min="0" step="0.1" value={value} onChange={e => setter(e.target.value)} className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm" />
                </label>
              ))}
            </div>
          </div>
        )}

        <div className={cn('rounded-2xl p-6 text-white shadow-xl', stock !== null && netWeight > stock ? 'bg-rose-600' : method === 'MANUAL' ? 'bg-indigo-600' : 'bg-blue-600')}>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-[10px] uppercase font-bold opacity-80 mb-2">Net weight</p>
              {method === 'MANUAL' ? (
                <DigitFormattedInput value={manualNet} onChange={setManualNet} className="w-full bg-white/20 border border-white/30 rounded-lg px-3 py-2 text-xl font-black outline-none text-white" suffix="kg" />
              ) : (
                <p className="text-3xl font-black">{formatNumber(netWeight)} <span className="text-sm font-normal">kg</span></p>
              )}
            </div>
            <div className="text-right">
              {stock !== null ? (
                <>
                  <p className="text-[10px] uppercase font-bold opacity-80 mb-1">Available stock</p>
                  <p className="text-xl font-black">{formatNumber(stock)} kg</p>
                </>
              ) : isDirectDelivery ? (
                <span className="inline-flex items-center gap-1 bg-white/20 px-2 py-1 rounded-lg text-[10px] font-bold uppercase"><Truck size={14} /> Direct delivery</span>
              ) : null}
            </div>
            <div className="col-span-2 pt-4 border-t border-white/20">
              <p className="text-[10px] uppercase font-bold opacity-80 mb-2">Sale value</p>
              {method === 'MANUAL' ? (
                <DigitFormattedInput value={manualTotal} onChange={setManualTotal} className="w-full bg-white/20 border border-white/30 rounded-lg pl-8 pr-4 py-3 text-2xl font-black outline-none text-white" prefix="₦" />
              ) : (
                <p className="text-3xl font-black">{formatCurrency(totalValue)}</p>
              )}
              {isDirectDelivery && toNumber(supplierPrice) > 0 && (
                <p className="text-xs mt-2 opacity-90">Supplier credit: {formatCurrency(netWeight * toNumber(supplierPrice))}</p>
              )}
            </div>
          </div>
        </div>

        <button type="submit" disabled={submitting} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold shadow-xl disabled:opacity-50">
          {submitting ? 'Saving…' : tx ? 'Save changes' : 'Confirm sale'}
        </button>
      </form>
    </div>
  );
}
