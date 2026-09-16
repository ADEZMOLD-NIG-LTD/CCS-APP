/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowRightLeft, Check, Copy, Edit, Trash2 } from 'lucide-react';
import type { StoreRecord, Warehouse } from '../../types';
import { cn, formatNumber } from '../../lib/utils';

interface StoreRecordListProps {
  records: StoreRecord[];
  warehouses: Warehouse[];
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (record: StoreRecord) => void;
  onDelete: (record: StoreRecord) => void;
}

export default function StoreRecordList({ records, warehouses, canEdit, canDelete, onEdit, onDelete }: StoreRecordListProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const name = (id?: string) => warehouses.find(w => w.id === id)?.name || 'Unknown';

  const copy = (id: string) => {
    navigator.clipboard?.writeText(id).catch(() => undefined);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            {['Date', 'Type', 'Commodity', 'Customer / route', 'Nominal (kg)', 'Actual (kg)', 'Bags', 'Truck / officer', 'Tranx ID', ''].map(h => (
              <th key={h} className="px-6 py-4 text-sm font-semibold text-gray-900 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {records.map(record => (
            <tr key={record.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{new Date(record.date).toLocaleDateString()}</td>
              <td className="px-6 py-4">
                <span className={cn('px-2 py-1 rounded-full text-xs font-medium', record.type === 'IN' ? 'bg-green-100 text-green-700' : record.type === 'OUT' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700')}>{record.type}</span>
              </td>
              <td className="px-6 py-4 text-sm font-medium text-gray-900">{record.commodity}</td>
              <td className="px-6 py-4 text-sm">
                {record.type === 'TRANSFER' ? (
                  <span className="flex items-center gap-1"><span className="text-red-600">{name(record.sourceWarehouseId)}</span><ArrowRightLeft className="w-3 h-3" /><span className="text-green-600">{name(record.destinationWarehouseId)}</span></span>
                ) : (
                  <span className="font-medium text-gray-900">{record.customerName}<span className="block text-xs text-gray-500">{name(record.warehouseId)}{record.location ? ` · ${record.location}` : ''}</span></span>
                )}
              </td>
              <td className="px-6 py-4 text-sm text-right text-gray-600">{formatNumber(record.nominalWeight)}</td>
              <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">{formatNumber(record.actualWeight)}</td>
              <td className="px-6 py-4 text-sm text-gray-600">{formatNumber(record.noOfBags, 0)}</td>
              <td className="px-6 py-4 text-sm"><span className="text-gray-900">{record.truckNo}</span><span className="block text-xs text-gray-500">{record.fieldOfficer}</span></td>
              <td className="px-6 py-4">
                <span className="flex items-center gap-2">
                  <code className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-600">{record.id.slice(0, 13)}</code>
                  <button onClick={() => copy(record.id)} className="p-1 text-gray-400 hover:text-indigo-600" aria-label="Copy transaction ID">
                    {copiedId === record.id ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                  </button>
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {canEdit && <button onClick={() => onEdit(record)} className="p-1 text-gray-400 hover:text-indigo-600" aria-label="Edit record"><Edit className="w-4 h-4" /></button>}
                {canDelete && <button onClick={() => onDelete(record)} className="p-1 text-gray-400 hover:text-red-600" aria-label="Delete record"><Trash2 className="w-4 h-4" /></button>}
              </td>
            </tr>
          ))}
          {records.length === 0 && (
            <tr><td colSpan={10} className="px-6 py-12 text-center text-gray-500 italic">No records for the selected filters.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
