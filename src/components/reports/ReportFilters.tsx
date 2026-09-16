/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { Warehouse } from '../../types';
import type { ReportType } from './ReportTabs';

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
  commodities: string[];
  activeReport: ReportType;
}

const field = 'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20';
const BALANCE_REPORTS: ReportType[] = ['supplier_balances', 'buyer_balances', 'packaging_inventory'];

export default function ReportFilters({
  startDate, setStartDate, endDate, setEndDate, selectedWarehouseId, setSelectedWarehouseId,
  selectedCommodity, setSelectedCommodity, warehouses, commodities, activeReport,
}: ReportFiltersProps) {
  const showCommodity = ['operational_purchases', 'operational_sales', 'transfers'].includes(activeReport);
  const balancesOnly = BALANCE_REPORTS.includes(activeReport);
  const showWarehouse = activeReport !== 'payroll';

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <label className="block text-[10px] font-bold text-slate-400 uppercase">
          {balancesOnly ? 'From (movements list)' : 'From'}
          <input type="date" value={startDate} max={endDate} onChange={e => e.target.value && setStartDate(e.target.value)} className={`${field} mt-1`} />
        </label>
        <label className="block text-[10px] font-bold text-slate-400 uppercase">
          {balancesOnly ? 'Balances as at' : 'To'}
          <input type="date" value={endDate} min={startDate} onChange={e => e.target.value && setEndDate(e.target.value)} className={`${field} mt-1`} />
        </label>
      </div>

      {(showWarehouse || showCommodity) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {showWarehouse && (
            <label className="block text-[10px] font-bold text-slate-400 uppercase">Warehouse
              <select value={selectedWarehouseId} onChange={e => setSelectedWarehouseId(e.target.value)} className={`${field} mt-1`}>
                <option value="ALL">All warehouses</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </label>
          )}
          {showCommodity && (
            <label className="block text-[10px] font-bold text-slate-400 uppercase">Commodity
              <select value={selectedCommodity} onChange={e => setSelectedCommodity(e.target.value)} className={`${field} mt-1`}>
                <option value="ALL">All commodities</option>
                {commodities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          )}
        </div>
      )}
    </div>
  );
}
