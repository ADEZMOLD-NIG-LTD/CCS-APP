/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Package, ArrowRightLeft, X } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { CommodityType, StoreRecord, Warehouse } from '../types';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, query, orderBy, where, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { reportFirestoreError, OperationType } from '../lib/firestore';
import { recordAuditLog, AuditAction } from '../lib/audit';
import Toast from './Toast';
import { formatNumber } from '../lib/utils';

// Sub-components
import StoreRecordForm from './store/StoreRecordForm';
import StoreRecordList from './store/StoreRecordList';
import StoreKeeperSummary from './store/StoreKeeperSummary';

const COMMODITIES: CommodityType[] = ['COCOA', 'CASHEW', 'PK'];

export default function StoreKeeperModule() {
  const { profile, isStoreKeeper, isAdmin, isManager, isOnline } = useAuth();
  const [records, setRecords] = useState<StoreRecord[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingRecord, setEditingRecord] = useState<StoreRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

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
          setErrorMessage(`Insufficient stock in ${warehouses.find(w => w.id === sourceId)?.name}. Available: ${formatNumber(currentStock)} kg`);
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

      const writePromise = setDoc(doc(db, 'store_records', recordId), recordData);
      
      if (!isOnline) {
        console.log('Working offline, proceeding optimistically');
      } else {
        await writePromise;
      }
      
      // Record Audit Log (non-blocking for UI)
      recordAuditLog({
        companyId: profile.companyId,
        userId: profile.uid,
        userEmail: profile.email,
        action: editingRecord ? AuditAction.UPDATE : AuditAction.CREATE,
        module: 'Store Keeper',
        recordId: recordId,
        details: `${editingRecord ? 'Updated' : 'Created'} store record (${recordData.type}) for ${recordData.commodity} - ${recordData.customerName}`,
        newData: recordData,
        previousData: editingRecord || undefined
      }).catch(err => console.error('Audit log failed:', err));

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
      const writePromise = updateDoc(doc(db, 'store_records', id), { isDeleted: true });
      
      if (!isOnline) {
        console.log('Working offline, proceeding optimistically');
      } else {
        await writePromise;
      }
      
      // Record Audit Log (non-blocking for UI)
      recordAuditLog({
        companyId: profile?.companyId || '',
        userId: profile?.uid || '',
        userEmail: profile?.email || '',
        action: AuditAction.DELETE,
        module: 'Store Keeper',
        recordId: id,
        details: `Deleted store record ${id}`
      }).catch(err => console.error('Audit log failed:', err));

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
      <StoreKeeperSummary
        totals={totals}
        inventoryByCommodity={inventoryByCommodity}
        recordCount={filteredRecords.length}
      />

      {/* Records Table */}
      <StoreRecordList
        records={filteredRecords}
        warehouses={warehouses}
        onEdit={(record) => {
          setEditingRecord(record);
          setIsAdding(true);
        }}
        onDelete={handleDelete}
      />

      {/* Modal Form */}
      <AnimatePresence>
        {isAdding && (
          <StoreRecordForm
            formData={formData}
            setFormData={setFormData}
            editingRecord={editingRecord}
            warehouses={warehouses}
            submitting={submitting}
            onCancel={resetForm}
            onSubmit={handleSubmit}
            getWarehouseStock={getWarehouseStock}
            commodities={COMMODITIES}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
