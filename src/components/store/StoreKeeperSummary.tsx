/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { StoreRecord, Warehouse } from '../../types';
import { ArrowLeftRight, ArrowRightLeft, Scale, History } from 'lucide-react';

interface StoreKeeperSummaryProps {
  totals: {
    totalInWeight: number;
    totalInBags: number;
    totalOutWeight: number;
    totalOutBags: number;
    inByCommodity: Record<string, { weight: number; bags: number }>;
    outByCommodity: Record<string, { weight: number; bags: number }>;
  };
  inventoryByCommodity: Record<string, { quantity: number; bags: number }>;
  recordCount: number;
}

export default function StoreKeeperSummary({ totals, inventoryByCommodity, recordCount }: StoreKeeperSummaryProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-green-50 rounded-lg">
            <ArrowLeftRight className="w-5 h-5 text-green-600" />
          </div>
          <span className="text-sm font-medium text-gray-500">Total IN (Weight)</span>
        </div>
        <div className="space-y-2">
          {Object.entries(totals.inByCommodity).map(([commodity, data]) => (
            <div key={commodity} className="flex justify-between items-center bg-green-50/50 p-2 rounded-lg">
              <span className="text-sm font-bold text-green-800">{commodity}</span>
              <span className="text-sm font-black text-green-900">
                {data.weight.toLocaleString()} kg <span className="text-[10px] font-normal opacity-70">({data.bags} bags)</span>
              </span>
            </div>
          ))}
          {Object.keys(totals.inByCommodity).length === 0 && (
            <div className="text-2xl font-bold text-gray-300 italic">No records</div>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-red-50 rounded-lg">
            <ArrowRightLeft className="w-5 h-5 text-red-600" />
          </div>
          <span className="text-sm font-medium text-gray-500">Total OUT (Weight)</span>
        </div>
        <div className="space-y-2">
          {Object.entries(totals.outByCommodity).map(([commodity, data]) => (
            <div key={commodity} className="flex justify-between items-center bg-red-50/50 p-2 rounded-lg">
              <span className="text-sm font-bold text-red-800">{commodity}</span>
              <span className="text-sm font-black text-red-900">
                {data.weight.toLocaleString()} kg <span className="text-[10px] font-normal opacity-70">({data.bags} bags)</span>
              </span>
            </div>
          ))}
          {Object.keys(totals.outByCommodity).length === 0 && (
            <div className="text-2xl font-bold text-gray-300 italic">No records</div>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-indigo-50 rounded-lg">
            <Scale className="w-5 h-5 text-indigo-600" />
          </div>
          <span className="text-sm font-medium text-gray-500">Current Stock</span>
        </div>
        <div className="space-y-2">
          {Object.entries(inventoryByCommodity).map(([commodity, data]) => (
            <div key={commodity} className="flex justify-between items-center bg-indigo-50/50 p-2 rounded-lg">
              <span className="text-sm font-bold text-indigo-800">{commodity}</span>
              <span className="text-sm font-black text-indigo-900">
                {data.quantity.toLocaleString()} kg <span className="text-[10px] font-normal opacity-70">({data.bags} bags)</span>
              </span>
            </div>
          ))}
          {Object.keys(inventoryByCommodity).length === 0 && (
            <div className="text-2xl font-bold text-gray-300 italic">Empty</div>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-amber-50 rounded-lg">
            <History className="w-5 h-5 text-amber-600" />
          </div>
          <span className="text-sm font-medium text-gray-500">Total Records</span>
        </div>
        <div className="text-2xl font-bold text-gray-900">{recordCount}</div>
        <div className="text-sm text-gray-500">In selected period</div>
      </div>
    </div>
  );
}
