/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { StoreRecord, Warehouse } from '../../types';
import { ArrowRightLeft, Edit, Trash2, Copy, Check } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatNumber } from '../../lib/utils';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface StoreRecordListProps {
  records: StoreRecord[];
  warehouses: Warehouse[];
  onEdit: (record: StoreRecord) => void;
  onDelete: (id: string) => void;
}

export default function StoreRecordList({ records, warehouses, onEdit, onDelete }: StoreRecordListProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-6 py-4 text-sm font-semibold text-gray-900">Date</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-900">Type</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-900">Commodity</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-900">Customer/Location</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">Nominal (kg)</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">Actual (kg)</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-900">Bags</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-900">Truck/Officer</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-900">Tranx ID</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {records.map((record) => (
              <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 text-sm text-gray-600">
                  {new Date(record.date).toLocaleDateString()}
                </td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "px-2 py-1 rounded-full text-xs font-medium",
                    record.type === 'IN' ? "bg-green-100 text-green-700" : 
                    record.type === 'OUT' ? "bg-red-100 text-red-700" :
                    "bg-blue-100 text-blue-700"
                  )}>
                    {record.type}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{record.commodity}</td>
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900">
                    {record.type === 'TRANSFER' ? (
                      <div className="flex items-center gap-1">
                        <span className="text-red-600">{warehouses.find(w => w.id === record.sourceWarehouseId)?.name || 'Unknown'}</span>
                        <ArrowRightLeft className="w-3 h-3" />
                        <span className="text-green-600">{warehouses.find(w => w.id === record.destinationWarehouseId)?.name || 'Unknown'}</span>
                      </div>
                    ) : record.customerName}
                  </div>
                  <div className="text-xs text-gray-500">{record.location}</div>
                </td>
                <td className="px-6 py-4 text-sm text-right text-gray-600">
                  {formatNumber(record.nominalWeight)}
                </td>
                <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">
                  {formatNumber(record.actualWeight)}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{formatNumber(record.noOfBags, 0)}</td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">{record.truckNo}</div>
                  <div className="text-xs text-gray-500">{record.fieldOfficer}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <code className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-600">
                      {record.id}
                    </code>
                    <button
                      onClick={() => handleCopyId(record.id)}
                      className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                      title="Copy Transaction ID"
                    >
                      {copiedId === record.id ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                    </button>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onEdit(record)}
                      className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(record.id)}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr>
                <td colSpan={10} className="px-6 py-12 text-center text-gray-500 italic">
                  No records found for the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
