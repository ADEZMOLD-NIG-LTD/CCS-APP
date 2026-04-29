/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Warehouse, CommodityType } from '../../types';
import { ReportType } from './ReportTabs';

interface ReportFiltersProps {
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  selectedWarehouseId: string;
  setSelectedWarehouseId: (id: string) => void;
  selectedCommodity: string;
  setSelectedCommodity: (commodity: string) => void;
  warehouses: Warehouse[];
  activeReport: ReportType;
}

export default function ReportFilters({
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  selectedWarehouseId,
  setSelectedWarehouseId,
  selectedCommodity,
  setSelectedCommodity,
  warehouses,
  activeReport
}: ReportFiltersProps) {
  const showStockFilter = ['operational_purchases', 'operational_sales', 'transfers'].includes(activeReport);

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">From</label>
          <input 
            type="date" 
            value={startDate} 
            onChange={e => setStartDate(e.target.value)} 
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all" 
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">To</label>
          <input 
            type="date" 
            value={endDate} 
            onChange={e => setEndDate(e.target.value)} 
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all" 
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Warehouse</label>
          <select 
            value={selectedWarehouseId} 
            onChange={e => setSelectedWarehouseId(e.target.value)} 
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
          >
            <option value="ALL">All Warehouses</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>

        {showStockFilter && (
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Stock Type</label>
            <select 
              value={selectedCommodity} 
              onChange={e => setSelectedCommodity(e.target.value)} 
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
            >
              <option value="ALL">All Commodities</option>
              <option value="COCOA">Cocoa</option>
              <option value="CASHEW">Cashew</option>
              <option value="PK">Palm Kernel (PK)</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
