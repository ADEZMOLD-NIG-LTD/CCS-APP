/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Truck, Calculator, Users } from 'lucide-react';
import { CommodityType, Warehouse, Supplier, Buyer, UserProfile } from '../../types';
import { cn, formatNumber, formatCurrency } from '../../lib/utils';

interface SaleFormProps {
  profile: UserProfile | null;
  commodity: CommodityType;
  setCommodity: (c: CommodityType) => void;
  grossWeight: number | string;
  setGrossWeight: (w: number | string) => void;
  moistureActual: number | string;
  setMoistureActual: (m: number | string) => void;
  moistureBenchmark: number | string;
  setMoistureBenchmark: (m: number | string) => void;
  tareWeight: number | string;
  setTareWeight: (w: number | string) => void;
  moldWeight: number | string;
  setMoldWeight: (w: number | string) => void;
  otherDeduction: number | string;
  setOtherDeduction: (d: number | string) => void;
  isDirectDelivery: boolean;
  setIsDirectDelivery: (d: boolean) => void;
  isSupplierBuyer: boolean;
  setIsSupplierBuyer: (s: boolean) => void;
  selectedWarehouseId: string;
  setSelectedWarehouseId: (id: string) => void;
  warehouses: Warehouse[];
  suppliers: Supplier[];
  buyers: Buyer[];
  inventory: Record<CommodityType, number>;
  netWeight: number;
  submitting: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}

const COMMODITIES: CommodityType[] = ['COCOA', 'CASHEW', 'PK'];

export default function SaleForm({
  profile,
  commodity,
  setCommodity,
  grossWeight,
  setGrossWeight,
  moistureActual,
  setMoistureActual,
  moistureBenchmark,
  setMoistureBenchmark,
  tareWeight,
  setTareWeight,
  moldWeight,
  setMoldWeight,
  otherDeduction,
  setOtherDeduction,
  isDirectDelivery,
  setIsDirectDelivery,
  isSupplierBuyer,
  setIsSupplierBuyer,
  selectedWarehouseId,
  setSelectedWarehouseId,
  warehouses,
  suppliers,
  buyers,
  inventory,
  netWeight,
  submitting,
  onSubmit,
  onCancel
}: SaleFormProps) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold">Record New Sale</h2>
        <button onClick={onCancel} className="text-slate-400">Cancel</button>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck size={18} className="text-slate-400" />
              <span className="text-sm font-bold text-slate-700">Direct Delivery</span>
            </div>
            <button
              type="button"
              onClick={() => setIsDirectDelivery(!isDirectDelivery)}
              className={cn(
                "w-12 h-6 rounded-full transition-all relative",
                isDirectDelivery ? "bg-blue-600" : "bg-slate-300"
              )}
            >
              <div className={cn(
                "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                isDirectDelivery ? "left-7" : "left-1"
              )} />
            </button>
          </div>
          <p className="text-[10px] text-slate-500 font-medium leading-tight">
            Enable this if the supplier is delivering directly to the buyer. This will bypass warehouse inventory checks and credit the supplier's ledger.
          </p>
        </div>

        <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-indigo-400" />
              <span className="text-sm font-bold text-indigo-700">Supplier as Buyer</span>
            </div>
            <button
              type="button"
              onClick={() => setIsSupplierBuyer(!isSupplierBuyer)}
              className={cn(
                "w-12 h-6 rounded-full transition-all relative",
                isSupplierBuyer ? "bg-indigo-600" : "bg-slate-300"
              )}
            >
              <div className={cn(
                "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                isSupplierBuyer ? "left-7" : "left-1"
              )} />
            </button>
          </div>
          <p className="text-[10px] text-indigo-500 font-medium leading-tight">
            Enable this if a registered supplier is the one buying from the company. This will debit the supplier's ledger.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {!isDirectDelivery && (
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Warehouse</label>
              <select 
                value={selectedWarehouseId} 
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                required 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">ALL WAREHOUSES</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          )}
          {isDirectDelivery && (
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Supplier (Direct Delivery From)</label>
              <select name="supplierId" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select Supplier</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          <div className="col-span-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              {isSupplierBuyer ? 'Supplier (Buying From Company)' : 'Buyer'}
            </label>
            {isSupplierBuyer ? (
              <select name="supplierId" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Select Supplier</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            ) : (
              <select name="buyerId" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select Buyer</option>
                {buyers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
          </div>
          <div className="col-span-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Store Record ID (Tranx ID)</label>
            <input 
              name="storeRecordId" 
              type="text" 
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" 
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
            <input name="bags" type="number" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="0" />
          </div>
        </div>

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
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Selling Price per kg (₦)</label>
            <input name="price" type="number" step="0.01" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-lg" placeholder="0.00" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Truck No</label>
            <input name="truckNo" type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="ABC-123" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Staff Name</label>
            <input name="staffName" type="text" defaultValue={profile?.displayName} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="Staff Name" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Driver's Name</label>
            <input name="driverName" type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="John Doe" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Driver's Phone</label>
            <input name="driverPhone" type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="080..." />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Notes</label>
          <textarea name="notes" rows={2} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none resize-none" placeholder="Additional details..."></textarea>
        </div>

        <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 space-y-4">
          <h3 className="text-xs font-bold text-blue-800 flex items-center gap-2">
            <Calculator size={14} /> Deduction Parameters
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-blue-600 uppercase mb-1">Actual Moisture (%)</label>
              <input 
                type="number" 
                step="0.1" 
                value={moistureActual} 
                onChange={(e) => setMoistureActual(e.target.value)}
                className="w-full px-4 py-2 bg-white border border-blue-200 rounded-lg outline-none text-sm" 
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-blue-600 uppercase mb-1">Benchmark (%)</label>
              <input 
                type="number" 
                step="0.1" 
                value={moistureBenchmark} 
                onChange={(e) => setMoistureBenchmark(e.target.value)}
                className="w-full px-4 py-2 bg-white border border-blue-200 rounded-lg outline-none text-sm" 
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-blue-600 uppercase mb-1">TARE (kg)</label>
              <input 
                type="number" 
                step="0.1" 
                value={tareWeight} 
                onChange={(e) => setTareWeight(e.target.value)}
                className="w-full px-4 py-2 bg-white border border-blue-200 rounded-lg outline-none text-sm" 
              />
            </div>
          </div>
        </div>

        <div className={cn(
          "rounded-2xl p-4 text-white flex flex-col gap-4 shadow-lg transition-all",
          !isDirectDelivery && netWeight > inventory[commodity] ? "bg-rose-600" : "bg-blue-600"
        )}>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[10px] uppercase font-bold opacity-80">Final Net Weight</p>
              <p className="text-2xl font-black">{formatNumber(netWeight)} <span className="text-sm font-normal">kg</span></p>
            </div>
            {!isDirectDelivery && (
              <div className="text-right">
                <p className="text-[10px] uppercase font-bold opacity-80">Available {commodity} Stock</p>
                <p className="text-xl font-black">
                  {formatNumber(inventory[commodity] || 0)} <span className="text-xs font-normal">kg</span>
                </p>
                {netWeight > inventory[commodity] && (
                  <p className="text-[9px] font-bold text-rose-200 mt-1 uppercase tracking-tighter animate-pulse">
                    Insufficient Stock
                  </p>
                )}
              </div>
            )}
            {isDirectDelivery && (
              <div className="text-right">
                <div className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-lg">
                  <Truck size={14} />
                  <span className="text-[10px] font-bold uppercase">Direct Delivery</span>
                </div>
              </div>
            )}
          </div>
          <div className="pt-3 border-t border-white/20 flex justify-between items-center">
            <p className="text-[10px] uppercase font-bold opacity-80">Total Value</p>
            <p className="text-lg font-bold">{formatCurrency(netWeight * (Number((document.querySelector('input[name="price"]') as HTMLInputElement)?.value) || 0) || 0)}</p>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting ? 'Confirming...' : 'Confirm Sale'}
        </button>
      </form>
    </div>
  );
}
