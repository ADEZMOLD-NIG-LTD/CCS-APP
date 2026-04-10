/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Package, ArrowRightLeft, ArrowLeftRight, X, History, Calculator, Warehouse as WarehouseIcon, Scale, Droplets, Trash2, AlertCircle, Edit, Filter, Download, Search, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CommodityType, StoreRecord, Warehouse } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, query, orderBy, where, updateDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, reportFirestoreError, OperationType } from '../lib/firestore';
import { recordAuditLog, AuditAction } from '../lib/audit';
import Toast from './Toast';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const COMMODITIES: CommodityType[] = ['COCOA', 'CASHEW', 'PK'];

export default function StoreKeeperModule() {
  const { profile, isStoreKeeper, isAdmin, isManager } = useAuth();
  const [records, setRecords] = useState<StoreRecord[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingRecord, setEditingRecord] = useState<StoreRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Default selected warehouse for staff
  useEffect(() => {
    if (profile?.assignedWarehouseId && !isAdmin && !isManager) {
      setSelectedWarehouseId(profile.assignedWarehouseId);
    }
  }, [profile, isAdmin, isManager]);

  // Load Data
  useEffect(() => {
    if (!profile?.companyId) return;

    const qRecords = query(
      collection(db, 'store_records'),
      where('companyId', '==', profile.companyId),
      orderBy('date', 'desc')
    );
    const unsubscribeRecords = onSnapshot(qRecords, (snapshot) => {
      const data = snapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id } as StoreRecord))
        .filter(r => !r.isDeleted);
      setRecords(data);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'store_records')));

    const qWarehouses = query(
      collection(db, 'warehouses'),
      where('companyId', '==', profile.companyId),
      orderBy('name', 'asc')
    );
    const unsubscribeWarehouses = onSnapshot(qWarehouses, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Warehouse));
      setWarehouses(data);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'warehouses')));

    return () => {
      unsubscribeRecords();
      unsubscribeWarehouses();
    };
  }, [profile?.companyId]);

  // Form State
  const [formData, setFormData] = useState<Partial<StoreRecord>>({
    type: 'IN',
    commodity: 'COCOA',
    date: new Date().toISOString().split('T')[0],
    customerName: '',
    location: '',
    nominalWeight: 0,
    actualWeight: 0,
    noOfBags: 0,
    moisture: 0,
    tare: 0,
    fieldOfficer: '',
    truckNo: '',
    warehouseId: profile?.assignedWarehouseId || ''
  });

  useEffect(() => {
    if (editingRecord) {
      setFormData(editingRecord);
    }
  }, [editingRecord]);

  const getWarehouseStock = (warehouseId: string, commodity: string, excludeId?: string) => {
    return records.reduce((total, r) => {
      if (r.id === excludeId || r.commodity !== commodity) return total;
      
      if (r.type === 'TRANSFER') {
        if (r.sourceWarehouseId === warehouseId) return total - r.actualWeight;
        if (r.destinationWarehouseId === warehouseId) return total + r.actualWeight;
      } else {
        if (r.warehouseId === warehouseId) {
          return r.type === 'IN' ? total + r.actualWeight : total - r.actualWeight;
        }
      }
      return total;
    }, 0);
  };

  const resetForm = () => {
    setFormData({
      type: 'IN',
      commodity: 'COCOA',
      date: new Date().toISOString().split('T')[0],
      customerName: '',
      location: '',
      nominalWeight: 0,
      actualWeight: 0,
      noOfBags: 0,
      moisture: 0,
      tare: 0,
      fieldOfficer: '',
      truckNo: '',
      warehouseId: profile?.assignedWarehouseId || ''
    });
    setEditingRecord(null);
    setIsAdding(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.companyId) return;

    // Validation for Stock Availability
    if (formData.type === 'OUT' || formData.type === 'TRANSFER') {
      const sourceId = formData.type === 'TRANSFER' ? formData.sourceWarehouseId : formData.warehouseId;
      if (sourceId) {
        const currentStock = getWarehouseStock(sourceId, formData.commodity!, editingRecord?.id);
        
        if (formData.actualWeight! > currentStock) {
          setErrorMessage(`Insufficient stock in ${warehouses.find(w => w.id === sourceId)?.name}. Available: ${currentStock.toLocaleString()} kg`);
          return;
        }
      }
    }

    setSubmitting(true);

    try {
      const recordId = editingRecord?.id || `store_${Date.now()}`;
      const recordData = {
        ...formData,
        id: recordId,
        companyId: profile.companyId,
        date: new Date(formData.date!).toISOString()
      } as StoreRecord;

      await setDoc(doc(db, 'store_records', recordId), recordData);
      
      // Record Audit Log
      await recordAuditLog({
        companyId: profile.companyId,
        userId: profile.uid,
        userEmail: profile.email,
        action: editingRecord ? AuditAction.UPDATE : AuditAction.CREATE,
        module: 'Store Keeper',
        recordId: recordId,
        details: `${editingRecord ? 'Updated' : 'Created'} store record (${recordData.type}) for ${recordData.commodity} - ${recordData.customerName}`,
        newData: recordData,
        previousData: editingRecord || undefined
      });

      setSuccessMessage(editingRecord ? 'Record updated successfully' : 'Record added successfully');
      resetForm();
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, OperationType.WRITE, 'store_records'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    try {
      await updateDoc(doc(db, 'store_records', id), { isDeleted: true });
      
      // Record Audit Log
      await recordAuditLog({
        companyId: profile?.companyId || '',
        userId: profile?.uid || '',
        userEmail: profile?.email || '',
        action: AuditAction.DELETE,
        module: 'Store Keeper',
        recordId: id,
        details: `Deleted store record ${id}`
      });

      setSuccessMessage('Record deleted successfully');
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, OperationType.DELETE, 'store_records'));
    }
  };

  // Filtered Records
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const rDate = new Date(r.date).toISOString().split('T')[0];
      const matchesDate = rDate >= dateFilter.start && rDate <= dateFilter.end;
      
      let matchesWarehouse = false;
      if (selectedWarehouseId === 'ALL') {
        matchesWarehouse = true;
      } else if (r.type === 'TRANSFER') {
        matchesWarehouse = r.sourceWarehouseId === selectedWarehouseId || r.destinationWarehouseId === selectedWarehouseId;
      } else {
        matchesWarehouse = r.warehouseId === selectedWarehouseId;
      }
      
      return matchesDate && matchesWarehouse;
    });
  }, [records, dateFilter, selectedWarehouseId]);

  // Inventory Calculation
  const inventoryByCommodity = useMemo(() => {
    const inv: Record<string, { quantity: number; bags: number }> = {};
    records.forEach(r => {
      if (r.type === 'TRANSFER') {
        // Handle source warehouse (OUT)
        if (selectedWarehouseId === 'ALL' || r.sourceWarehouseId === selectedWarehouseId) {
          const key = r.commodity;
          if (!inv[key]) inv[key] = { quantity: 0, bags: 0 };
          inv[key].quantity -= r.actualWeight;
          inv[key].bags -= r.noOfBags;
        }
        // Handle destination warehouse (IN)
        if (selectedWarehouseId === 'ALL' || r.destinationWarehouseId === selectedWarehouseId) {
          const key = r.commodity;
          if (!inv[key]) inv[key] = { quantity: 0, bags: 0 };
          inv[key].quantity += r.actualWeight;
          inv[key].bags += r.noOfBags;
        }
      } else {
        // Handle IN/OUT
        if (selectedWarehouseId !== 'ALL' && r.warehouseId !== selectedWarehouseId) return;
        
        const key = r.commodity;
        if (!inv[key]) inv[key] = { quantity: 0, bags: 0 };
        if (r.type === 'IN') {
          inv[key].quantity += r.actualWeight;
          inv[key].bags += r.noOfBags;
        } else {
          inv[key].quantity -= r.actualWeight;
          inv[key].bags -= r.noOfBags;
        }
      }
    });
    return inv;
  }, [records, selectedWarehouseId]);

  // Totals for filtered view
  const totals = useMemo(() => {
    return filteredRecords.reduce((acc, r) => {
      const commodity = r.commodity;
      
      if (r.type === 'TRANSFER') {
        // For transfers, we count them as IN for destination and OUT for source
        // if they match the current warehouse filter
        
        // Transfer OUT from source
        if (selectedWarehouseId === 'ALL' || r.sourceWarehouseId === selectedWarehouseId) {
          acc.totalOutWeight += r.actualWeight;
          acc.totalOutBags += r.noOfBags;
          if (!acc.outByCommodity[commodity]) acc.outByCommodity[commodity] = { weight: 0, bags: 0 };
          acc.outByCommodity[commodity].weight += r.actualWeight;
          acc.outByCommodity[commodity].bags += r.noOfBags;
        }
        
        // Transfer IN to destination
        if (selectedWarehouseId === 'ALL' || r.destinationWarehouseId === selectedWarehouseId) {
          acc.totalInWeight += r.actualWeight;
          acc.totalInBags += r.noOfBags;
          if (!acc.inByCommodity[commodity]) acc.inByCommodity[commodity] = { weight: 0, bags: 0 };
          acc.inByCommodity[commodity].weight += r.actualWeight;
          acc.inByCommodity[commodity].bags += r.noOfBags;
        }
      } else {
        // Standard IN/OUT
        if (r.type === 'IN') {
          acc.totalInWeight += r.actualWeight;
          acc.totalInBags += r.noOfBags;
          if (!acc.inByCommodity[commodity]) acc.inByCommodity[commodity] = { weight: 0, bags: 0 };
          acc.inByCommodity[commodity].weight += r.actualWeight;
          acc.inByCommodity[commodity].bags += r.noOfBags;
        } else {
          acc.totalOutWeight += r.actualWeight;
          acc.totalOutBags += r.noOfBags;
          if (!acc.outByCommodity[commodity]) acc.outByCommodity[commodity] = { weight: 0, bags: 0 };
          acc.outByCommodity[commodity].weight += r.actualWeight;
          acc.outByCommodity[commodity].bags += r.noOfBags;
        }
      }
      return acc;
    }, { 
      totalInWeight: 0, 
      totalInBags: 0, 
      totalOutWeight: 0, 
      totalOutBags: 0,
      inByCommodity: {} as Record<string, { weight: number; bags: number }>,
      outByCommodity: {} as Record<string, { weight: number; bags: number }>
    });
  }, [filteredRecords, selectedWarehouseId]);

  return (
    <div className="space-y-6">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-8 h-8 text-indigo-600" />
            Store Keeper Inventory
          </h2>
          <p className="text-gray-500">Dual control warehouse records</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setFormData({
                ...formData,
                type: 'TRANSFER',
                sourceWarehouseId: selectedWarehouseId !== 'ALL' ? selectedWarehouseId : '',
                destinationWarehouseId: '',
                nominalWeight: 0,
                actualWeight: 0,
                noOfBags: 0
              });
              setIsAdding(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200"
          >
            <ArrowRightLeft className="w-5 h-5" />
            Transfer Stock
          </button>
          <button
            onClick={() => {
              setFormData({
                ...formData,
                type: 'IN',
                warehouseId: selectedWarehouseId !== 'ALL' ? selectedWarehouseId : (profile?.assignedWarehouseId || '')
              });
              setIsAdding(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Record
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse</label>
          <select
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            className="w-full rounded-lg border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="ALL">All Warehouses</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
          <input
            type="date"
            value={dateFilter.start}
            onChange={(e) => setDateFilter(prev => ({ ...prev, start: e.target.value }))}
            className="w-full rounded-lg border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
          <input
            type="date"
            value={dateFilter.end}
            onChange={(e) => setDateFilter(prev => ({ ...prev, end: e.target.value }))}
            className="w-full rounded-lg border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Summary Cards */}
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
          <div className="text-2xl font-bold text-gray-900">{filteredRecords.length}</div>
          <div className="text-sm text-gray-500">In selected period</div>
        </div>
      </div>

      {/* Records Table */}
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
              {filteredRecords.map((record) => (
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
                    {record.nominalWeight.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">
                    {record.actualWeight.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{record.noOfBags}</td>
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
                        onClick={() => {
                          setEditingRecord(record);
                          setIsAdding(true);
                        }}
                        className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(record.id)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500 italic">
                    No records found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form */}
      <AnimatePresence>
        {isAdding && (
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
                  onClick={resetForm}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
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
                            Available: {getWarehouseStock(formData.sourceWarehouseId, formData.commodity!, editingRecord?.id).toLocaleString()} kg
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
                          Available: {getWarehouseStock(formData.warehouseId, formData.commodity!, editingRecord?.id).toLocaleString()} kg
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Commodity</label>
                    <select
                      value={formData.commodity}
                      onChange={(e) => setFormData({ ...formData, commodity: e.target.value as CommodityType })}
                      className="w-full rounded-lg border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    >
                      {COMMODITIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
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
                    <input
                      type="number"
                      value={formData.nominalWeight}
                      onChange={(e) => setFormData({ ...formData, nominalWeight: Number(e.target.value) })}
                      className="w-full rounded-lg border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Actual Weight (kg)</label>
                    <input
                      type="number"
                      value={formData.actualWeight}
                      onChange={(e) => setFormData({ ...formData, actualWeight: Number(e.target.value) })}
                      className="w-full rounded-lg border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">No of Bags</label>
                    <input
                      type="number"
                      value={formData.noOfBags}
                      onChange={(e) => setFormData({ ...formData, noOfBags: Number(e.target.value) })}
                      className="w-full rounded-lg border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                      required
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
                    onClick={() => {
                      setIsAdding(false);
                      setEditingRecord(null);
                    }}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {submitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    {editingRecord ? 'Update Record' : 'Save Record'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Notifications */}
      <AnimatePresence>
        {successMessage && (
          <Toast
            message={successMessage}
            type="success"
            onClose={() => setSuccessMessage(null)}
          />
        )}
        {errorMessage && (
          <Toast
            message={errorMessage}
            type="error"
            onClose={() => setErrorMessage(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
