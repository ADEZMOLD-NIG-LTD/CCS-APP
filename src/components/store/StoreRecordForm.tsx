/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { motion } from 'motion/react';
import type { StoreRecord, Warehouse } from '../../types';
import { isoToLocalDate, todayLocal } from '../../lib/dates';
import { formatWeight, roundWeight, toNumber, WEIGHT_DECIMALS } from '../../lib/utils';
import { DigitFormattedInput } from '../DigitFormattedInput';
import CommodityPicker from '../inventory/CommodityPicker';

export interface StoreRecordInput {
  type: 'IN' | 'OUT' | 'TRANSFER';
  date: string;
  commodity: string;
  customerName: string;
  location: string;
  nominalWeight: number;
  actualWeight: number;
  noOfBags: number;
  moisture: number;
  tare: number;
  fieldOfficer: string;
  truckNo: string;
  warehouseId: string;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
}

interface StoreRecordFormProps {
  initialType: 'IN' | 'TRANSFER';
  editingRecord: StoreRecord | null;
  warehouses: Warehouse[];
  defaultWarehouseId: string;
  available: (warehouseId: string, commodity: string) => number;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (input: StoreRecordInput) => void;
}

const field = 'w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500';

export default function StoreRecordForm({ initialType, editingRecord: r, warehouses, defaultWarehouseId, available, submitting, onCancel, onSubmit }: StoreRecordFormProps) {
  const [type, setType] = useState<StoreRecordInput['type']>(r?.type ?? initialType);
  const [date, setDate] = useState(r ? isoToLocalDate(r.date) || todayLocal() : todayLocal());
  const [commodity, setCommodity] = useState(r?.commodity ?? 'COCOA');
  const [warehouseId, setWarehouseId] = useState(r?.warehouseId || defaultWarehouseId);
  const [sourceWarehouseId, setSource] = useState(r?.sourceWarehouseId ?? defaultWarehouseId);
  const [destinationWarehouseId, setDestination] = useState(r?.destinationWarehouseId ?? '');
  const [customerName, setCustomerName] = useState(r?.customerName ?? '');
  const [location, setLocation] = useState(r?.location ?? '');
  const [nominal, setNominal] = useState(String(r?.nominalWeight ?? ''));
  const [actual, setActual] = useState(String(r?.actualWeight ?? ''));
  const [bags, setBags] = useState(String(r?.noOfBags ?? ''));
  const [moisture, setMoisture] = useState(String(r?.moisture ?? ''));
  const [tare, setTare] = useState(String(r?.tare ?? ''));
  const [fieldOfficer, setFieldOfficer] = useState(r?.fieldOfficer ?? '');
  const [truckNo, setTruckNo] = useState(r?.truckNo ?? '');
  const [error, setError] = useState<string | null>(null);

  const outgoingWarehouse = type === 'TRANSFER' ? sourceWarehouseId : type === 'OUT' ? warehouseId : '';
  let stock = outgoingWarehouse ? available(outgoingWarehouse, commodity) : null;
  if (stock !== null && r && r.commodity === commodity) {
    const ownOut = r.type === 'TRANSFER' ? r.sourceWarehouseId : r.type === 'OUT' ? r.warehouseId : '';
    if (ownOut === outgoingWarehouse) stock += r.actualWeight;
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const actualWeight = roundWeight(toNumber(actual));
    if (actualWeight <= 0) return setError('Actual weight must be greater than zero.');
    if (type === 'TRANSFER') {
      if (!sourceWarehouseId || !destinationWarehouseId) return setError('Select both warehouses.');
      if (sourceWarehouseId === destinationWarehouseId) return setError('Source and destination must differ.');
    } else {
      if (!warehouseId) return setError('Select a warehouse.');
      if (!customerName.trim()) return setError('Enter the customer or supplier name.');
    }
    if (stock !== null && actualWeight > stock) return setError(`Only ${formatWeight(stock)}kg is recorded in store.`);
    onSubmit({
      type, date, commodity, customerName: customerName.trim(), location: location.trim(),
      nominalWeight: roundWeight(Math.max(0, toNumber(nominal))), actualWeight, noOfBags: Math.max(0, Math.round(toNumber(bags))),
      moisture: Math.max(0, toNumber(moisture)), tare: Math.max(0, toNumber(tare)), fieldOfficer: fieldOfficer.trim(), truckNo: truckNo.trim(),
      warehouseId, sourceWarehouseId, destinationWarehouseId,
    });
  };

  const warehouseSelect = (value: string, onChange: (v: string) => void, label: string, exclude?: string) => (
    <label className="block text-sm font-medium text-gray-700">{label}
      <select required value={value} onChange={e => onChange(e.target.value)} className={`${field} mt-1`}>
        <option value="">Select warehouse</option>
        {warehouses.filter(w => w.id !== exclude).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>
    </label>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" role="dialog">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <h3 className="text-xl font-bold text-gray-900">{r ? 'Edit store record' : 'New store record'}</h3>
          <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-full" aria-label="Close"><X className="w-6 h-6 text-gray-500" /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-6">
          {error && <p className="bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl p-3" role="alert">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <label className="block text-sm font-medium text-gray-700">Type
              <select value={type} disabled={!!r} onChange={e => setType(e.target.value as StoreRecordInput['type'])} className={`${field} mt-1`}>
                <option value="IN">IN (received)</option>
                <option value="OUT">OUT (dispatched)</option>
                <option value="TRANSFER">TRANSFER</option>
              </select>
            </label>
            {type === 'TRANSFER' ? (
              <>
                {warehouseSelect(sourceWarehouseId, setSource, 'From')}
                {warehouseSelect(destinationWarehouseId, setDestination, 'To', sourceWarehouseId)}
              </>
            ) : warehouseSelect(warehouseId, setWarehouseId, 'Warehouse')}
            <label className="block text-sm font-medium text-gray-700">Commodity
              <div className="mt-1"><CommodityPicker value={commodity} onChange={setCommodity} className={field} /></div>
              {stock !== null && <span className="block text-xs text-indigo-600 mt-1">In store: {formatWeight(stock)}kg</span>}
            </label>
            <label className="block text-sm font-medium text-gray-700">Date
              <input type="date" required max={todayLocal()} value={date} onChange={e => setDate(e.target.value)} className={`${field} mt-1`} />
            </label>
            <label className="block text-sm font-medium text-gray-700">Customer / supplier
              <input required={type !== 'TRANSFER'} maxLength={200} value={customerName} onChange={e => setCustomerName(e.target.value)} className={`${field} mt-1`} />
            </label>
            <label className="block text-sm font-medium text-gray-700">Location
              <input maxLength={120} value={location} onChange={e => setLocation(e.target.value)} className={`${field} mt-1`} />
            </label>
            <label className="block text-sm font-medium text-gray-700">Nominal weight
              <div className="mt-1"><DigitFormattedInput value={nominal} onChange={setNominal} decimals={WEIGHT_DECIMALS} className={field} suffix="kg" /></div>
            </label>
            <label className="block text-sm font-medium text-gray-700">Actual weight
              <div className="mt-1"><DigitFormattedInput required value={actual} onChange={setActual} decimals={WEIGHT_DECIMALS} className={field} suffix="kg" /></div>
            </label>
            <label className="block text-sm font-medium text-gray-700">Bags
              <div className="mt-1"><DigitFormattedInput value={bags} onChange={setBags} decimals={0} className={field} /></div>
            </label>
            <label className="block text-sm font-medium text-gray-700">Moisture (%)
              <input type="number" min="0" step="any" value={moisture} onChange={e => setMoisture(e.target.value)} className={`${field} mt-1`} />
            </label>
            <label className="block text-sm font-medium text-gray-700">Tare (kg)
              <input type="number" min="0" step="any" value={tare} onChange={e => setTare(e.target.value)} className={`${field} mt-1`} />
            </label>
            <label className="block text-sm font-medium text-gray-700">Field officer
              <input maxLength={100} value={fieldOfficer} onChange={e => setFieldOfficer(e.target.value)} className={`${field} mt-1`} />
            </label>
            <label className="block text-sm font-medium text-gray-700">Truck number
              <input maxLength={30} value={truckNo} onChange={e => setTruckNo(e.target.value)} className={`${field} mt-1`} />
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
            <button type="button" onClick={onCancel} className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700">Cancel</button>
            <button type="submit" disabled={submitting} className="px-6 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50">{submitting ? 'Saving…' : r ? 'Update record' : 'Save record'}</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
