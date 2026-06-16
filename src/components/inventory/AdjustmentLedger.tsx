/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Trash2, Edit3, Calendar, Search, HelpCircle, User, Info } from 'lucide-react';
import { InventoryAdjustment, Warehouse, CommodityType, AdjustmentTypeValue } from '../../types';
import { formatNumber } from '../../lib/utils';

interface AdjustmentLedgerProps {
  adjustments: InventoryAdjustment[];
  warehouses: Warehouse[];
  isAdmin: boolean;
  onEdit: (adj: InventoryAdjustment) => void;
  onDelete: (id: string) => void;
}

const TYPE_BADGES: Record<AdjustmentTypeValue, { label: string; bg: string; text: string }> = {
  WEIGHT_LOSS: { label: 'Weight Loss', bg: 'bg-amber-100', text: 'text-amber-800' },
  DAMAGED_STOCK: { label: 'Damaged Stock', bg: 'bg-rose-100', text: 'text-rose-800' },
  SPOILAGE: { label: 'Spoilage', bg: 'bg-red-100', text: 'text-red-800' },
  THEFT_LOSS: { label: 'Theft / Loss', bg: 'bg-slate-100', text: 'text-slate-800' },
  STOCK_COUNT: { label: 'Stock Count', bg: 'bg-blue-100', text: 'text-blue-800' },
  QUALITY_TEST: { label: 'Quality Test', bg: 'bg-purple-100', text: 'text-purple-800' },
  INTERNAL_USE: { label: 'Internal Use', bg: 'bg-indigo-100', text: 'text-indigo-800' }
};

export default function AdjustmentLedger({
  adjustments,
  warehouses,
  isAdmin,
  onEdit,
  onDelete
}: AdjustmentLedgerProps) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');

  const filtered = adjustments.filter(adj => {
    if (adj.isDeleted) return false;
    const warehouseName = warehouses.find(w => w.id === adj.warehouseId)?.name || '';
    const matchesSearch = 
      warehouseName.toLowerCase().includes(search.toLowerCase()) || 
      (adj.notes || '').toLowerCase().includes(search.toLowerCase()) ||
      adj.creatorEmail.toLowerCase().includes(search.toLowerCase());
    
    const matchesType = filterType === 'ALL' || adj.adjustmentType === filterType;

    return matchesSearch && matchesType;
  });

  return (
    <div className="bg-white rounded-3xl border border-[var(--border)] overflow-hidden shadow-sm">
      {/* Header and filters */}
      <div className="p-5 border-b border-[var(--border)] space-y-4 md:space-y-0 md:flex md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-[var(--text-primary)]">Inventory Adjustment Ledger</h3>
          <p className="text-xs text-slate-500">Tracks moisture weight loss, spoilage, damage, and stock sheet corrections.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          {/* Search */}
          <div className="relative flex-1 sm:w-60">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search notes, warehouse..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="google-input text-xs pl-10"
            />
          </div>

          {/* Filter Reason */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="google-input text-xs sm:w-52"
          >
            <option value="ALL">All Adjustment Types</option>
            <option value="WEIGHT_LOSS">Weight Loss</option>
            <option value="DAMAGED_STOCK">Damaged Stock</option>
            <option value="SPOILAGE">Spoilage</option>
            <option value="THEFT_LOSS">Theft / Loss</option>
            <option value="STOCK_COUNT">Stock Count</option>
            <option value="QUALITY_TEST">Quality Test</option>
            <option value="INTERNAL_USE">Internal Use</option>
          </select>
        </div>
      </div>

      {/* Ledger Table */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center text-slate-400">
          <Info size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="font-medium text-sm">No adjustments found</p>
          <p className="text-xs mt-1">There are no inventory adjustments logged matching the filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-[var(--border)] text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                <th className="py-3 px-5">Date</th>
                <th className="py-3 px-5">Warehouse Store</th>
                <th className="py-3 px-5">Commodity</th>
                <th className="py-3 px-5">Adjustment Type / Reason</th>
                <th className="py-3 px-5 text-right">Qty (Bags)</th>
                <th className="py-3 px-5 text-right">Net Weight</th>
                <th className="py-3 px-5">Auditor / Source Notes</th>
                {isAdmin && <th className="py-3 px-5 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-[var(--text-primary)]">
              {filtered.map(adj => {
                const badge = TYPE_BADGES[adj.adjustmentType] || { label: adj.adjustmentType, bg: 'bg-gray-100', text: 'text-gray-800' };
                const warehouseName = warehouses.find(w => w.id === adj.warehouseId)?.name || 'Unknown';
                const isAdd = adj.adjustmentDirection === 'ADD';

                return (
                  <tr key={adj.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Date */}
                    <td className="py-4 px-5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-slate-400" />
                        <span>{new Date(adj.date).toLocaleDateString()}</span>
                      </div>
                    </td>

                    {/* Warehouse */}
                    <td className="py-4 px-5 font-medium">{warehouseName}</td>

                    {/* Commodity */}
                    <td className="py-4 px-5">
                      <span className="font-bold text-slate-700">{adj.commodity}</span>
                    </td>

                    {/* Badge */}
                    <td className="py-4 px-5 whitespace-nowrap">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                    </td>

                    {/* Bags */}
                    <td className={`py-4 px-5 text-right font-semibold ${isAdd ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {isAdd ? '+' : '-'}{formatNumber(adj.bags, 0)} bags
                    </td>

                    {/* Weight */}
                    <td className={`py-4 px-5 text-right font-bold ${isAdd ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {isAdd ? '+' : '-'}{formatNumber(adj.netWeight)} kg
                    </td>

                    {/* Notes & Creator */}
                    <td className="py-4 px-5 max-w-xs">
                      <div className="space-y-0.5">
                        <p className="font-medium text-slate-800 break-words">{adj.notes}</p>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                          <User size={10} />
                          <span>{adj.creatorEmail}</span>
                        </div>
                      </div>
                    </td>

                    {/* Actions */}
                    {isAdmin && (
                      <td className="py-4 px-5 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => onEdit(adj)}
                            className="p-1 hover:bg-slate-100 text-slate-500 hover:text-[var(--accent)] rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => onDelete(adj.id)}
                            className="p-1 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
