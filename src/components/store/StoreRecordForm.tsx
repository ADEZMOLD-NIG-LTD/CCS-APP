/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { StoreRecord, Warehouse, CommodityType } from '../../types';
import { X } from 'lucide-react';
import { motion } from 'motion/react';
import { formatNumber } from '../../lib/utils';
import { DigitFormattedInput } from '../DigitFormattedInput';

interface StoreRecordFormProps {
  formData: Partial<StoreRecord>;
  setFormData: (data: Partial<StoreRecord>) => void;
  editingRecord: StoreRecord | null;
  warehouses: Warehouse[];
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
  getWarehouseStock: (warehouseId: string, commodity: string, excludeId?: string) => number;
  commodities: CommodityType[];
}

export default function StoreRecordForm({
  formData,
  setFormData,
  editingRecord,
  warehouses,
  submitting,
  onCancel,
  onSubmit,
  getWarehouseStock,
  commodities
}: StoreRecordFormProps) {
  const [isCustomCommodity, setIsCustomCommodity] = React.useState<boolean>(() => {
    return !!formData.commodity && !commodities.includes(formData.commodity);
  });
  const [customName, setCustomName] = React.useState<string>(() => {
    return formData.commodity && !commodities.includes(formData.commodity)
      ? formData.commodity
      : '';
  });

  const handleCustomNameChange = (val: string) => {
    setCustomName(val);
    setFormData({ ...formData, commodity: val.trim() || 'Custom Item' });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <h3 className="text-xl font-bold text-gray-900">
            {editingRecord ? 'Edit Store Record' : 'Add Store Record'}
          </h3>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as 'IN' | 'OUT' | 'TRANSFER' })}
                className="w-full rounded-lg border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                required
              >
                <option value="IN">IN (Inventory Increase)</option>
                <option value="OUT">OUT (Inventory Decrease)</option>
                <option value="TRANSFER">TRANSFER (Between Warehouses)</option>
              </select>
            </div>

            {formData.type === 'TRANSFER' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Source Warehouse</label>
                  <select
                    value={formData.sourceWarehouseId}
                    onChange={(e) => setFormData({ ...formData, sourceWarehouseId: e.target.value })}
                    className="w-full rounded-lg border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  >
                    <option value="">Select Source</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                  {formData.sourceWarehouseId && (
                    <p className="mt-1 text-xs font-medium text-indigo-600">
                      Available: {formatNumber(getWarehouseStock(formData.sourceWarehouseId, formData.commodity!, editingRecord?.id))} kg
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Destination Warehouse</label>
                  <select
                    value={formData.destinationWarehouseId}
                    onChange={(e) => setFormData({ ...formData, destinationWarehouseId: e.target.value })}
                    className="w-full rounded-lg border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  >
                    <option value="">Select Destination</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse</label>
                <select
                  value={formData.warehouseId}
                  onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                  className="w-full rounded-lg border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                >
                  <option value="">Select Warehouse</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
                {formData.type === 'OUT' && formData.warehouseId && (
                  <p className="mt-1 text-xs font-medium text-indigo-600">
                    Available: {formatNumber(getWarehouseStock(formData.warehouseId, formData.commodity!, editingRecord?.id))} kg
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Commodity</label>
              <div className="flex flex-col gap-2">
                <select
                  value={isCustomCommodity ? "OTHER" : formData.commodity}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "OTHER") {
                      setIsCustomCommodity(true);
                      setFormData({ ...formData, commodity: customName.trim() || 'Custom Item' });
                    } else {
                      setIsCustomCommodity(false);
                      setFormData({ ...formData, commodity: val as CommodityType });
                    }
                  }}
                  className="w-full rounded-lg border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                >
                  {commodities.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  <option value="OTHER">Other (Custom Stock Item)</option>
                </select>
                {isCustomCommodity && (
                  <input
                    type="text"
                    required
                    placeholder="Enter custom item name"
                    value={customName}
                    onChange={(e) => handleCustomNameChange(e.target.value)}
                    className="w-full rounded-lg border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 mt-1"
                  />
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full rounded-lg border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer/Supplier Name</label>
              <input
                type="text"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                className="w-full rounded-lg border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full rounded-lg border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Origin/Destination"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nominal Weight (kg)</label>
              <DigitFormattedInput
                value={formData.nominalWeight ?? ''}
                onChange={(val) => setFormData({ ...formData, nominalWeight: Number(val) })}
                className="w-full rounded-lg border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                required
                suffix="kg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Actual Weight (kg)</label>
              <DigitFormattedInput
                value={formData.actualWeight ?? ''}
                onChange={(val) => setFormData({ ...formData, actualWeight: Number(val) })}
                className="w-full rounded-lg border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                required
                suffix="kg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">No of Bags</label>
              <DigitFormattedInput
                value={formData.noOfBags ?? ''}
                onChange={(val) => setFormData({ ...formData, noOfBags: Number(val) })}
                className="w-full rounded-lg border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                required
                suffix="bags"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Moisture (%)</label>
              <input
                type="number"
                step="0.1"
                value={formData.moisture}
                onChange={(e) => setFormData({ ...formData, moisture: Number(e.target.value) })}
                className="w-full rounded-lg border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tare (kg)</label>
              <input
                type="number"
                step="0.1"
                value={formData.tare}
                onChange={(e) => setFormData({ ...formData, tare: Number(e.target.value) })}
                className="w-full rounded-lg border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Field Officer</label>
              <input
                type="text"
                value={formData.fieldOfficer}
                onChange={(e) => setFormData({ ...formData, fieldOfficer: e.target.value })}
                className="w-full rounded-lg border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Officer name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Truck Number</label>
              <input
                type="text"
                value={formData.truckNo}
                onChange={(e) => setFormData({ ...formData, truckNo: e.target.value })}
                className="w-full rounded-lg border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="ABC-123-XY"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-lg disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                editingRecord ? 'Update Record' : 'Save Record'
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
