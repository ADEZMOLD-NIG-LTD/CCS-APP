/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Calendar, Tag, HardDrive, HelpCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { CommodityType, Warehouse, UserProfile, AdjustmentTypeValue, InventoryAdjustment } from '../../types';
import { DigitFormattedInput } from '../DigitFormattedInput';

interface AdjustmentFormProps {
  warehouses: Warehouse[];
  getWarehouseStock: (warehouseId: string, commodity: CommodityType) => number;
  profile: UserProfile | null;
  editingAdjustment?: InventoryAdjustment | null;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (data: any) => Promise<void>;
}

const ADJUSTMENT_TYPES: { value: AdjustmentTypeValue; label: string; defaultDir: 'ADD' | 'REMOVE' }[] = [
  { value: 'WEIGHT_LOSS', label: 'Weight Loss (Moisture / Shrinkage)', defaultDir: 'REMOVE' },
  { value: 'DAMAGED_STOCK', label: 'Damaged Stock', defaultDir: 'REMOVE' },
  { value: 'SPOILAGE', label: 'Spoilage', defaultDir: 'REMOVE' },
  { value: 'THEFT_LOSS', label: 'Theft / Loss', defaultDir: 'REMOVE' },
  { value: 'STOCK_COUNT', label: 'Stock Count Adjustment', defaultDir: 'REMOVE' },
  { value: 'QUALITY_TEST', label: 'Quality Test Consumption', defaultDir: 'REMOVE' },
  { value: 'INTERNAL_USE', label: 'Internal Use', defaultDir: 'REMOVE' }
];

export default function AdjustmentForm({
  warehouses,
  getWarehouseStock,
  profile,
  editingAdjustment,
  submitting,
  onCancel,
  onSubmit
}: AdjustmentFormProps) {
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [commodity, setCommodity] = useState<CommodityType>('COCOA');
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentTypeValue>('WEIGHT_LOSS');
  const [adjustmentDirection, setAdjustmentDirection] = useState<'ADD' | 'REMOVE'>('REMOVE');
  const [netWeight, setNetWeight] = useState<number | string>('');
  const [bags, setBags] = useState<number | string>('');
  const [notes, setNotes] = useState<string>('');
  const [errorW, setErrorW] = useState<string | null>(null);

  const [isCustomCommodity, setIsCustomCommodity] = useState<boolean>(() => {
    return !!editingAdjustment && !['COCOA', 'CASHEW', 'PK'].includes(editingAdjustment.commodity);
  });
  const [customName, setCustomName] = useState<string>(() => {
    return editingAdjustment && !['COCOA', 'CASHEW', 'PK'].includes(editingAdjustment.commodity)
      ? editingAdjustment.commodity
      : '';
  });

  const handleCustomNameChange = (val: string) => {
    setCustomName(val);
    setCommodity(val.trim() || 'Custom Item');
  };

  // Default warehouse to staff's store if set
  useEffect(() => {
    if (profile?.assignedWarehouseId) {
      setWarehouseId(profile.assignedWarehouseId);
    } else if (warehouses.length > 0 && !warehouseId) {
      setWarehouseId(warehouses[0].id);
    }
  }, [profile, warehouses]);

  // Handle default direction change when adjustment type changes
  useEffect(() => {
    const found = ADJUSTMENT_TYPES.find(t => t.value === adjustmentType);
    if (found && adjustmentType !== 'STOCK_COUNT') {
      setAdjustmentDirection(found.defaultDir);
    }
  }, [adjustmentType]);

  // Load editing adjustment data if editing
  useEffect(() => {
    if (editingAdjustment) {
      setDate(editingAdjustment.date.split('T')[0]);
      setCommodity(editingAdjustment.commodity);
      setWarehouseId(editingAdjustment.warehouseId);
      setAdjustmentType(editingAdjustment.adjustmentType);
      setAdjustmentDirection(editingAdjustment.adjustmentDirection);
      setNetWeight(editingAdjustment.netWeight);
      setBags(editingAdjustment.bags);
      setNotes(editingAdjustment.notes || '');
      const isCustom = !['COCOA', 'CASHEW', 'PK'].includes(editingAdjustment.commodity);
      setIsCustomCommodity(isCustom);
      setCustomName(isCustom ? editingAdjustment.commodity : '');
    }
  }, [editingAdjustment]);

  // Validate stock level warning
  useEffect(() => {
    const weightNum = Number(netWeight) || 0;
    if (adjustmentDirection === 'REMOVE' && warehouseId && commodity && weightNum > 0) {
      const currentStock = getWarehouseStock(warehouseId, commodity);
      const allowedStock = editingAdjustment ? currentStock + editingAdjustment.netWeight : currentStock;
      if (weightNum > allowedStock) {
        setErrorW(`Warning: Current warehouse stock is ${allowedStock.toLocaleString()} kg. This adjustment will result in negative inventory!`);
      } else {
        setErrorW(null);
      }
    } else {
      setErrorW(null);
    }
  }, [adjustmentDirection, warehouseId, commodity, netWeight, getWarehouseStock, editingAdjustment]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseId) return;

    onSubmit({
      date,
      commodity,
      warehouseId,
      adjustmentType,
      adjustmentDirection,
      netWeight: Number(netWeight) || 0,
      bags: Number(bags) || 0,
      notes
    });
  };

  return (
    <div id="adjustment_entry_parent" className="bg-white rounded-3xl border border-[var(--border)] p-6 shadow-sm max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-bold">
          ±
        </div>
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">
            {editingAdjustment ? 'Modify Inventory Adjustment' : 'Log New Inventory Adjustment'}
          </h2>
          <p className="text-slate-500 text-xs">
            Adjust stock for moisture shrinkage, damage, test samples or physical auditor counts.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Date Selector */}
          <div>
            <label className="google-label flex items-center gap-1.5">
              <Calendar size={14} className="text-slate-400" /> Date of Adjustment
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="google-input input-field text-sm"
              required
            />
          </div>

          {/* Warehouse Selector */}
          <div>
            <label className="google-label flex items-center gap-1.5">
              <HardDrive size={14} className="text-slate-400" /> Select Warehouse
            </label>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="google-input text-sm"
              required
              disabled={!!profile?.assignedWarehouseId}
            >
              <option value="">-- Choose Warehouse --</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Commodity Select */}
          <div className="col-span-1">
            <label className="google-label flex items-center gap-1.5 mb-1.5">
              <Tag size={14} className="text-slate-400" /> Commodity
            </label>
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
                className="google-input text-sm"
                required
              >
                {['COCOA', 'CASHEW', 'PK'].map(c => <option key={c} value={c}>{c}</option>)}
                <option value="OTHER">Other (Custom Stock Item)</option>
              </select>
              {isCustomCommodity && (
                <input
                  type="text"
                  required
                  placeholder="Enter custom item name"
                  value={customName}
                  onChange={(e) => handleCustomNameChange(e.target.value)}
                  className="google-input text-sm font-medium"
                />
              )}
            </div>
          </div>

          {/* Adjustment Reason/Type */}
          <div>
            <label className="google-label flex items-center gap-1.5">
              <HelpCircle size={14} className="text-slate-400" /> Adjustment Reason Type
            </label>
            <select
              value={adjustmentType}
              onChange={(e) => setAdjustmentType(e.target.value as AdjustmentTypeValue)}
              className="google-input text-sm"
              required
            >
              {ADJUSTMENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Direction Switcher */}
        <div>
          <label className="google-label">Adjustment Flow Direction</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setAdjustmentDirection('ADD')}
              disabled={adjustmentType !== 'STOCK_COUNT'}
              className={`py-3 px-4 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition-all ${
                adjustmentDirection === 'ADD'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-700 shadow-sm'
                  : 'border-[var(--border)] bg-white text-slate-400 opacity-60'
              }`}
            >
              <ArrowUpRight size={16} />
              <span>Add Stock (+)</span>
            </button>
            <button
              type="button"
              onClick={() => setAdjustmentDirection('REMOVE')}
              disabled={adjustmentType !== 'STOCK_COUNT'}
              className={`py-3 px-4 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition-all ${
                adjustmentDirection === 'REMOVE'
                  ? 'border-rose-600 bg-rose-50 text-rose-700 shadow-sm'
                  : 'border-[var(--border)] bg-white text-slate-400 opacity-60'
              }`}
            >
              <ArrowDownRight size={16} />
              <span>Deduct Stock (-)</span>
            </button>
          </div>
          {adjustmentType !== 'STOCK_COUNT' && (
            <p className="text-[10px] text-slate-400 mt-1 italic">
              Direction is pre-managed for non-count adjustment types to avoid reporting errors.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Net Weight Target */}
          <div>
            <label className="google-label">Weight Affected (kg)</label>
            <DigitFormattedInput
              value={netWeight}
              onChange={setNetWeight}
              className="google-input text-sm"
              placeholder="e.g. 150 kg"
              required
            />
          </div>

          {/* Bags Target */}
          <div>
            <label className="google-label">Bags Affected (Qty)</label>
            <DigitFormattedInput
              value={bags}
              onChange={setBags}
              className="google-input text-sm"
              placeholder="e.g. 2 bags"
              required
            />
          </div>
        </div>

        {/* Dynamic warning banner */}
        {errorW && (
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs font-medium">
            {errorW}
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="google-label">Description / Auditor Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="google-input text-sm min-h-[90px] p-3"
            placeholder="Provide specific notes detailing this correction (e.g., 'Moisture audit completed on Cocoa bags stack B')"
            required
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 google-btn-secondary text-sm font-bold py-3"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 google-btn-primary text-sm font-bold py-3"
          >
            {submitting ? 'Applying Adjustment...' : editingAdjustment ? 'Update Adjustment' : 'Post Adjustment'}
          </button>
        </div>
      </form>
    </div>
  );
}
