/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Calculator, Droplets, Scale } from 'lucide-react';
import { motion } from 'motion/react';
import { CommodityType, Transaction, Supplier, Warehouse, UserProfile } from '../../types';

const COMMODITIES: CommodityType[] = ['COCOA', 'CASHEW', 'PK'];
const BENCHMARKS = { COCOA: 8, CASHEW: 10, PK: 8 };

interface PurchaseFormProps {
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  suppliers: Supplier[];
  warehouses: Warehouse[];
  profile: UserProfile | null;
  editingTransaction: Transaction | null;
  submitting: boolean;
}

export default function PurchaseForm({
  onSubmit,
  onCancel,
  suppliers,
  warehouses,
  profile,
  editingTransaction,
  submitting
}: PurchaseFormProps) {
  const [commodity, setCommodity] = useState<CommodityType>(editingTransaction?.commodity || 'COCOA');
  const [grossWeight, setGrossWeight] = useState<number | string>(editingTransaction?.grossWeight || '');
  const [moistureActual, setMoistureActual] = useState<number | string>(editingTransaction?.deductions.moistureActual || 8);
  const [moistureBenchmark, setMoistureBenchmark] = useState<number | string>(editingTransaction?.deductions.moistureBenchmark || 10);
  const [tareWeight, setTareWeight] = useState<number | string>(editingTransaction?.deductions.tareWeight || '');
  const [moldWeight, setMoldWeight] = useState<number | string>(editingTransaction?.deductions.moldWeight || '');
  const [otherDeduction, setOtherDeduction] = useState<number | string>(editingTransaction?.deductions.otherDeduction || '');
  const [isWalkIn, setIsWalkIn] = useState(editingTransaction?.supplierId?.startsWith('WALK_IN_') || false);

  useEffect(() => {
    if (!editingTransaction) {
      setMoistureBenchmark(BENCHMARKS[commodity]);
    }
  }, [commodity, editingTransaction]);

  const moistureLoss = useMemo(() => {
    const actual = Number(moistureActual) || 0;
    const benchmark = Number(moistureBenchmark) || 0;
    const gross = Number(grossWeight) || 0;
    return ((actual - benchmark) * gross) / 100;
  }, [moistureActual, moistureBenchmark, grossWeight]);

  const totalDeductions = moistureLoss + Number(tareWeight) + Number(moldWeight) + Number(otherDeduction);
  const netWeight = Math.max(0, Number(grossWeight) - totalDeductions);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const data = {
      commodity,
      grossWeight: Number(grossWeight),
      netWeight,
      bags: Number(formData.get('bags')),
      price: Number(formData.get('price')),
      supplierId: formData.get('supplierId'),
      storeRecordId: formData.get('storeRecordId'),
      warehouseId: formData.get('warehouseId'),
      isWalkIn,
      deductions: {
        moistureActual: Number(moistureActual),
        moistureBenchmark: Number(moistureBenchmark),
        tareWeight: Number(tareWeight),
        moldWeight: Number(moldWeight),
        otherDeduction: Number(otherDeduction)
      }
    };
    
    onSubmit(data);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="google-card p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold">{editingTransaction ? 'Adjust Purchase Entry' : 'New Purchase Entry'}</h2>
        <button onClick={onCancel} className="text-slate-400">Cancel</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Warehouse</label>
            <select 
              name="warehouseId" 
              required 
              defaultValue={editingTransaction?.warehouseId || profile?.assignedWarehouseId || ''}
              disabled={!!profile?.assignedWarehouseId && profile?.role === 'STAFF'}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
            >
              <option value="" disabled>Select Warehouse</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <div className="flex justify-between items-center mb-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase">Supplier</label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={isWalkIn} 
                  onChange={(e) => setIsWalkIn(e.target.checked)}
                  className="w-3 h-3 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-[10px] font-bold text-slate-500 uppercase">Walk-in Supplier</span>
              </label>
            </div>
            {!isWalkIn ? (
              <select name="supplierId" required={!isWalkIn} defaultValue={editingTransaction?.supplierId || ''} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="">Select Supplier</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            ) : (
              <div className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-bold text-sm">
                WALK-IN SUPPLIER (GENERAL)
              </div>
            )}
          </div>
          <div className="col-span-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Store Record ID (Tranx ID)</label>
            <input 
              name="storeRecordId" 
              type="text" 
              defaultValue={editingTransaction?.storeRecordId || ''} 
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" 
              placeholder="Quote Tranx ID from Store Keeper" 
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Commodity</label>
            <select 
              value={commodity} 
              onChange={(e) => setCommodity(e.target.value as CommodityType)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
            >
              {COMMODITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">No of Bags</label>
            <input name="bags" type="number" defaultValue={editingTransaction?.bags || 0} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="0" />
          </div>
        </div>

        {/* Weight & Price */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Gross Weight (kg)</label>
            <input 
              type="number" 
              step="0.01" 
              required 
              value={grossWeight} 
              onChange={(e) => setGrossWeight(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-lg" 
              placeholder="0.00" 
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Price per kg (₦)</label>
            <input name="price" type="number" step="0.01" required defaultValue={editingTransaction?.pricePerKg || 0} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-lg" placeholder="0.00" />
          </div>
        </div>

        {/* Deduction Logic Section */}
        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 space-y-4">
          <h3 className="text-xs font-bold text-amber-800 flex items-center gap-2">
            <Calculator size={14} /> Deduction Parameters
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-amber-600 uppercase mb-1">Actual Moisture (%)</label>
              <div className="relative">
                <Droplets className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400" size={14} />
                <input 
                  type="number" 
                  step="0.1" 
                  value={moistureActual} 
                  onChange={(e) => setMoistureActual(e.target.value)}
                  className="w-full pl-8 pr-4 py-2 bg-white border border-amber-200 rounded-lg outline-none text-sm" 
                  placeholder="0.0"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-amber-600 uppercase mb-1">Benchmark (%)</label>
              <input 
                type="number" 
                step="0.1" 
                value={moistureBenchmark} 
                onChange={(e) => setMoistureBenchmark(e.target.value)}
                className="w-full px-4 py-2 bg-white border border-amber-200 rounded-lg outline-none text-sm" 
                placeholder="0.0"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-amber-600 uppercase mb-1">TARE (kg)</label>
              <div className="relative">
                <Scale className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400" size={14} />
                <input 
                  type="number" 
                  step="0.1" 
                  value={tareWeight} 
                  onChange={(e) => setTareWeight(e.target.value)}
                  className="w-full pl-8 pr-4 py-2 bg-white border border-amber-200 rounded-lg outline-none text-sm" 
                  placeholder="0.0"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-amber-600 uppercase mb-1">Mold/Quality (kg)</label>
              <input 
                type="number" 
                step="0.1" 
                value={moldWeight} 
                onChange={(e) => setMoldWeight(e.target.value)}
                className="w-full px-4 py-2 bg-white border border-amber-200 rounded-lg outline-none text-sm" 
                placeholder="0.0"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-amber-600 uppercase mb-1">Other (kg)</label>
              <input 
                type="number" 
                step="0.1" 
                value={otherDeduction} 
                onChange={(e) => setOtherDeduction(e.target.value)}
                className="w-full px-4 py-2 bg-white border border-amber-200 rounded-lg outline-none text-sm" 
                placeholder="0.0"
              />
            </div>
          </div>

          {/* Dynamic Calculation Summary */}
          <div className="pt-3 border-t border-amber-200 grid grid-cols-2 gap-2 text-[11px]">
            <div className="flex justify-between text-amber-700">
              <span>Moisture Loss:</span>
              <span className="font-bold">-{moistureLoss.toFixed(2)} kg</span>
            </div>
            <div className="flex justify-between text-amber-700">
              <span>Manual Deductions:</span>
              <span className="font-bold">-{(Number(tareWeight) + Number(moldWeight) + Number(otherDeduction)).toFixed(2)} kg</span>
            </div>
          </div>
        </div>

        {/* Final Result */}
        <div className="bg-emerald-600 rounded-2xl p-4 text-white flex justify-between items-center shadow-lg">
          <div>
            <p className="text-[10px] uppercase font-bold opacity-80">Final Net Weight</p>
            <p className="text-2xl font-black">{netWeight.toFixed(2)} <span className="text-sm font-normal">kg</span></p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase font-bold opacity-80">Total Deductions</p>
            <p className="text-lg font-bold">-{totalDeductions.toFixed(2)} kg</p>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting ? 'Confirming...' : 'Confirm Purchase'}
        </button>
      </form>
    </motion.div>
  );
}
