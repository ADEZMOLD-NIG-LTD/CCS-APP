/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Calculator, Droplets, Scale } from 'lucide-react';
import { motion } from 'motion/react';
import { CommodityType, Transaction, Supplier, Warehouse, UserProfile, CalculationMethod } from '../../types';
import { roundTo, formatNumber, formatCurrency, cn } from '../../lib/utils';
import { DigitFormattedInput } from '../DigitFormattedInput';

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
  const [commodity, setCommodity] = useState<string>(() => {
    return editingTransaction?.commodity || 'COCOA';
  });
  const [isCustomCommodity, setIsCustomCommodity] = useState<boolean>(() => {
    const defaultCommodities = ['COCOA', 'CASHEW', 'PK'];
    return !!editingTransaction?.commodity && !defaultCommodities.includes(editingTransaction.commodity);
  });
  const [customName, setCustomName] = useState<string>(() => {
    const defaultCommodities = ['COCOA', 'CASHEW', 'PK'];
    return !!editingTransaction?.commodity && !defaultCommodities.includes(editingTransaction.commodity)
      ? editingTransaction.commodity
      : '';
  });

  const handleCustomNameChange = (val: string) => {
    setCustomName(val);
    setCommodity(val.trim() || 'Custom Item');
  };

  const [calculationMethod, setCalculationMethod] = useState<CalculationMethod>(editingTransaction?.calculationMethod || 'DIRECT');
  const [grossWeight, setGrossWeight] = useState<number | string>(editingTransaction?.grossWeight || '');
  const [moistureActual, setMoistureActual] = useState<number | string>(editingTransaction?.deductions.moistureActual || 8);
  const [moistureBenchmark, setMoistureBenchmark] = useState<number | string>(editingTransaction?.deductions.moistureBenchmark || 10);
  const [tareWeight, setTareWeight] = useState<number | string>(editingTransaction?.deductions.tareWeight || '');
  const [moldWeight, setMoldWeight] = useState<number | string>(editingTransaction?.deductions.moldWeight || '');
  const [otherDeduction, setOtherDeduction] = useState<number | string>(editingTransaction?.deductions.otherDeduction || '');
  const [isWalkIn, setIsWalkIn] = useState(editingTransaction?.supplierId?.startsWith('WALK_IN_') || false);

  const [manualNetWeight, setManualNetWeight] = useState<number | string>(editingTransaction?.netWeight || '');
  const [manualTotalValue, setManualTotalValue] = useState<number | string>(editingTransaction?.totalValue || '');
  const [price, setPrice] = useState<number | string>(editingTransaction?.pricePerKg || 0);

  const [transactionDate, setTransactionDate] = useState<string>(() => {
    if (editingTransaction?.date) {
      return editingTransaction.date.substring(0, 10);
    }
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  React.useEffect(() => {
    if (editingTransaction?.date) {
      setTransactionDate(editingTransaction.date.substring(0, 10));
    }
  }, [editingTransaction]);

  React.useEffect(() => {
    if (!editingTransaction) {
      setMoistureBenchmark(BENCHMARKS[commodity as keyof typeof BENCHMARKS] || 8);
    }
  }, [commodity, editingTransaction]);

  const moistureLoss = React.useMemo(() => {
    const actual = Number(moistureActual) || 0;
    const benchmark = Number(moistureBenchmark) || 0;
    const gross = Number(grossWeight) || 0;
    return roundTo(((actual - benchmark) * gross) / 100, 2);
  }, [moistureActual, moistureBenchmark, grossWeight]);

  const totalDeductions = roundTo(moistureLoss + Number(tareWeight) + Number(moldWeight) + Number(otherDeduction), 2);
  
  const calculatedNetWeight = React.useMemo(() => {
    const gross = Number(grossWeight) || 0;
    return Math.max(0, roundTo(gross - totalDeductions, 2));
  }, [grossWeight, totalDeductions]);

  // Sync manual values with calculated values if not manually changed or if there are no manual inputs yet
  React.useEffect(() => {
    if (
      calculationMethod === 'DIRECT' || 
      !manualNetWeight || 
      manualNetWeight === '0' || 
      manualNetWeight === 0 ||
      !manualTotalValue || 
      manualTotalValue === '0' || 
      manualTotalValue === 0
    ) {
      setManualNetWeight(calculatedNetWeight);
      setManualTotalValue(roundTo(calculatedNetWeight * Number(price), 2));
    }
  }, [calculatedNetWeight, price, calculationMethod]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    // Fall back to automatic calculation if manual values are not set or are 0
    const finalNetWeight = calculationMethod === 'MANUAL' 
      ? (Number(manualNetWeight) || calculatedNetWeight) 
      : calculatedNetWeight;
      
    const finalTotalValue = calculationMethod === 'MANUAL' 
      ? (Number(manualTotalValue) || roundTo(finalNetWeight * Number(price), 2)) 
      : roundTo(finalNetWeight * Number(price), 2);
    
    const data = {
      commodity,
      calculationMethod,
      date: transactionDate,
      grossWeight: Number(grossWeight),
      netWeight: finalNetWeight,
      totalValue: finalTotalValue,
      bags: Number(formData.get('bags')),
      price: Number(price),
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
          <div className="col-span-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Warehouse</label>
            <select 
              name="warehouseId" 
              required 
              defaultValue={editingTransaction?.warehouseId || profile?.assignedWarehouseId || ''}
              disabled={!!profile?.assignedWarehouseId && profile?.role === 'STAFF'}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 text-sm"
            >
              <option value="" disabled>Select Warehouse</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div className="col-span-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Transaction Date</label>
            <input 
              name="transactionDate"
              type="date"
              required
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-medium"
            />
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
                {suppliers.filter(s => !s.isDeleted).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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
          <div className={isCustomCommodity ? "col-span-2" : "col-span-1"}>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Commodity</label>
            <div className="flex flex-col gap-2">
              <select 
                value={isCustomCommodity ? "OTHER" : commodity} 
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "OTHER") {
                    setIsCustomCommodity(true);
                    setCommodity(customName.trim() || 'Custom Item');
                  } else {
                    setIsCustomCommodity(false);
                    setCommodity(val);
                  }
                }}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm"
              >
                {COMMODITIES.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="OTHER">Other (Custom Stock Item)</option>
              </select>
              {isCustomCommodity && (
                <input
                  type="text"
                  required
                  placeholder="Enter custom item name"
                  value={customName}
                  onChange={(e) => handleCustomNameChange(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium focus:ring-2 focus:ring-emerald-500"
                />
              )}
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Calculation Method</label>
            <select 
              value={calculationMethod} 
              onChange={(e) => setCalculationMethod(e.target.value as CalculationMethod)}
              className="w-full px-4 py-3 bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold rounded-xl outline-none"
            >
              <option value="DIRECT">Direct (Auto)</option>
              <option value="MANUAL">Manual (Custom)</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">No of Bags</label>
            <DigitFormattedInput 
              name="bags" 
              defaultValue={editingTransaction?.bags || 0} 
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium" 
              placeholder="0" 
              suffix="bags"
            />
          </div>
        </div>

        {/* Weight & Price */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Gross Weight (kg)</label>
            <DigitFormattedInput 
              value={grossWeight} 
              onChange={setGrossWeight}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-lg" 
              placeholder="0.00" 
              suffix="kg"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Price per kg (₦)</label>
            <DigitFormattedInput 
              name="price" 
              value={price}
              onChange={setPrice}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-lg" 
              placeholder="0.00" 
              prefix="₦"
              required
            />
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
              <span className="font-bold">-{formatNumber(moistureLoss)} kg</span>
            </div>
            <div className="flex justify-between text-amber-700">
              <span>Manual Deductions:</span>
              <span className="font-bold">-{formatNumber(Number(tareWeight) + Number(moldWeight) + Number(otherDeduction))} kg</span>
            </div>
          </div>
        </div>

        {/* Final Result */}
        <div className={cn(
          "rounded-2xl p-6 text-white shadow-xl transition-all",
          calculationMethod === 'MANUAL' ? "bg-indigo-600" : "bg-emerald-600"
        )}>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-[10px] uppercase font-bold opacity-80 mb-2">Final Net Weight (kg)</p>
              {calculationMethod === 'MANUAL' ? (
                <DigitFormattedInput 
                  value={manualNetWeight}
                  onChange={setManualNetWeight}
                  className="w-full bg-white/20 border border-white/30 rounded-lg px-3 py-2 text-xl font-black outline-none placeholder:text-white/40 text-white"
                  placeholder="0.00"
                  suffix="kg"
                />
              ) : (
                <p className="text-3xl font-black">{formatNumber(calculatedNetWeight)} <span className="text-sm font-normal text-white/70">kg</span></p>
              )}
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase font-bold opacity-80 mb-2">Total Deductions</p>
              <p className="text-xl font-bold">-{formatNumber(totalDeductions)} <span className="text-sm font-normal opacity-70">kg</span></p>
            </div>
            <div className="col-span-2 pt-4 border-t border-white/20">
              <p className="text-[10px] uppercase font-bold opacity-80 mb-2">Total Amount (Final Figure)</p>
              {calculationMethod === 'MANUAL' ? (
                <DigitFormattedInput 
                  value={manualTotalValue}
                  onChange={setManualTotalValue}
                  className="w-full bg-white/20 border border-white/30 rounded-lg pl-8 pr-4 py-3 text-2xl font-black outline-none placeholder:text-white/40 text-white"
                  placeholder="0.00"
                  prefix="₦"
                />
              ) : (
                <p className="text-3xl font-black">{formatCurrency(calculatedNetWeight * Number(price))}</p>
              )}
            </div>
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
