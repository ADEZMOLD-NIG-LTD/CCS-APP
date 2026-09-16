/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Calendar, Edit3, Info, Search, Trash2, User } from 'lucide-react';
import type { AdjustmentTypeValue, InventoryAdjustment, Warehouse } from '../../types';
import { formatNumber } from '../../lib/utils';

interface AdjustmentLedgerProps {
  adjustments: InventoryAdjustment[];
  warehouses: Warehouse[];
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (adj: InventoryAdjustment) => void;
  onDelete: (adj: InventoryAdjustment) => void;
}

const TYPE_BADGES: Record<AdjustmentTypeValue, { label: string; className: string }> = {
  WEIGHT_LOSS: { label: 'Weight loss', className: 'bg-amber-100 text-amber-800' },
  DAMAGED_STOCK: { label: 'Damaged', className: 'bg-rose-100 text-rose-800' },
  SPOILAGE: { label: 'Spoilage', className: 'bg-red-100 text-red-800' },
  THEFT_LOSS: { label: 'Theft / loss', className: 'bg-slate-100 text-slate-800' },
  STOCK_COUNT: { label: 'Stock count', className: 'bg-blue-100 text-blue-800' },
  QUALITY_TEST: { label: 'Quality test', className: 'bg-purple-100 text-purple-800' },
  INTERNAL_USE: { label: 'Internal use', className: 'bg-indigo-100 text-indigo-800' },
};

export default function AdjustmentLedger({ adjustments, warehouses, canEdit, canDelete, onEdit, onDelete }: AdjustmentLedgerProps) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const showActions = canEdit || canDelete;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return adjustments.filter(adj => {
      const warehouseName = warehouses.find(w => w.id === adj.warehouseId)?.name || '';
      const matchesSearch = !q || warehouseName.toLowerCase().includes(q) || (adj.notes || '').toLowerCase().includes(q) || (adj.creatorEmail || '').toLowerCase().includes(q);
      return matchesSearch && (filterType === 'ALL' || adj.adjustmentType === filterType);
    });
  }, [adjustments, warehouses, search, filterType]);

  return (
    <div className="bg-white rounded-3xl border border-[var(--border)] overflow-hidden shadow-sm">
      <div className="p-5 border-b border-[var(--border)] space-y-4 md:space-y-0 md:flex md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-[var(--text-primary)]">Adjustment ledger</h3>
          <p className="text-xs text-slate-500">Moisture loss, spoilage, damage and stock count corrections.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 sm:w-60">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Search notes, warehouse…" value={search} onChange={e => setSearch(e.target.value)} className="google-input text-xs pl-10" />
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="google-input text-xs sm:w-52">
            <option value="ALL">All types</option>
            {Object.entries(TYPE_BADGES).map(([value, badge]) => <option key={value} value={value}>{badge.label}</option>)}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-12 text-center text-slate-400">
          <Info size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="font-medium text-sm">No adjustments found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-[var(--border)] text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                <th className="py-3 px-5">Date</th>
                <th className="py-3 px-5">Warehouse</th>
                <th className="py-3 px-5">Commodity</th>
                <th className="py-3 px-5">Type</th>
                <th className="py-3 px-5 text-right">Bags</th>
                <th className="py-3 px-5 text-right">Weight</th>
                <th className="py-3 px-5">Notes</th>
                {showActions && <th className="py-3 px-5 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-[var(--text-primary)]">
              {filtered.map(adj => {
                const badge = TYPE_BADGES[adj.adjustmentType] || { label: adj.adjustmentType, className: 'bg-gray-100 text-gray-800' };
                const isAdd = adj.adjustmentDirection === 'ADD';
                return (
                  <tr key={adj.id} className="hover:bg-slate-50/50">
                    <td className="py-4 px-5 whitespace-nowrap"><span className="flex items-center gap-2"><Calendar size={14} className="text-slate-400" />{new Date(adj.date).toLocaleDateString()}</span></td>
                    <td className="py-4 px-5 font-medium">{warehouses.find(w => w.id === adj.warehouseId)?.name || 'Unknown'}</td>
                    <td className="py-4 px-5 font-bold text-slate-700">{adj.commodity}</td>
                    <td className="py-4 px-5 whitespace-nowrap"><span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${badge.className}`}>{badge.label}</span></td>
                    <td className={`py-4 px-5 text-right font-semibold ${isAdd ? 'text-emerald-700' : 'text-rose-700'}`}>{isAdd ? '+' : '-'}{formatNumber(adj.bags, 0)}</td>
                    <td className={`py-4 px-5 text-right font-bold ${isAdd ? 'text-emerald-700' : 'text-rose-700'}`}>{isAdd ? '+' : '-'}{formatNumber(adj.netWeight)} kg</td>
                    <td className="py-4 px-5 max-w-xs">
                      <p className="font-medium text-slate-800 break-words">{adj.notes}</p>
                      <p className="flex items-center gap-1 text-[10px] text-slate-400"><User size={10} />{adj.creatorEmail}</p>
                    </td>
                    {showActions && (
                      <td className="py-4 px-5 whitespace-nowrap text-center">
                        {canEdit && <button onClick={() => onEdit(adj)} className="p-1 text-slate-500 hover:text-[var(--accent)]" aria-label="Edit adjustment"><Edit3 size={14} /></button>}
                        {canDelete && <button onClick={() => onDelete(adj)} className="p-1 text-slate-500 hover:text-rose-600" aria-label="Delete adjustment"><Trash2 size={14} /></button>}
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
