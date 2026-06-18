/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  TrendingUp, 
  Users, 
  ArrowLeft, 
  Package, 
  Scale, 
  Droplets, 
  Calculator, 
  History,
  UserPlus,
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
  Truck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CommodityType, Transaction, Buyer, DeductionParams, Warehouse, Supplier, CalculationMethod, InventoryAdjustment } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, query, orderBy, where, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, reportFirestoreError, formatFirestoreError, OperationType } from '../lib/firestore';
import { recordAuditLog, AuditAction } from '../lib/audit';
import Toast from './Toast';
import ConfirmModal from './ConfirmModal';
import { cn, roundTo, formatNumber, formatCurrency, getWeightInKg } from '../lib/utils';
import SaleForm from './sales/SaleForm';
import BuyerForm from './sales/BuyerForm';
import SalesList from './sales/SalesList';

const COMMODITIES: CommodityType[] = ['COCOA', 'CASHEW', 'PK'];
const BENCHMARKS = { COCOA: 8, CASHEW: 10, PK: 8 };

export default function SalesModule() {
  const { profile, isStaff, isAccount, isAdmin, canPostTransactions, isOnline } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isAddingSale, setIsAddingSale] = useState(false);
  const [isAddingBuyer, setIsAddingBuyer] = useState(false);
  const [isDirectDelivery, setIsDirectDelivery] = useState(false);
  const [isSupplierBuyer, setIsSupplierBuyer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('ALL');
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Default selected warehouse for staff
  useEffect(() => {
    if (profile?.assignedWarehouseId && !isAdmin) {
      setSelectedWarehouseId(profile.assignedWarehouseId);
    }
  }, [profile, isAdmin, profile?.assignedWarehouseId]);

  // Form State for Sale
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [calculationMethod, setCalculationMethod] = useState<CalculationMethod>('DIRECT');
  const [commodity, setCommodity] = useState<CommodityType>('COCOA');
  const [grossWeight, setGrossWeight] = useState<number | string>('');
  const [moistureActual, setMoistureActual] = useState<number | string>(8);
  const [moistureBenchmark, setMoistureBenchmark] = useState<number | string>(10);
  const [tareWeight, setTareWeight] = useState<number | string>('');
  const [moldWeight, setMoldWeight] = useState<number | string>('');
  const [otherDeduction, setOtherDeduction] = useState<number | string>('');
  const [price, setPrice] = useState<number | string>('');

  const [manualNetWeight, setManualNetWeight] = useState<number | string>('');
  const [manualTotalValue, setManualTotalValue] = useState<number | string>('');

  const handleEditSaleClick = (tx: Transaction) => {
    setEditingTransaction(tx);
    setCommodity(tx.commodity);
    setCalculationMethod(tx.calculationMethod || 'DIRECT');
    setGrossWeight(tx.grossWeight ?? '');
    setMoistureActual(tx.deductions?.moistureActual ?? 8);
    setMoistureBenchmark(tx.deductions?.moistureBenchmark ?? 10);
    setTareWeight(tx.deductions?.tareWeight ?? '');
    setMoldWeight(tx.deductions?.moldWeight ?? '');
    setOtherDeduction(tx.deductions?.otherDeduction ?? '');
    setPrice(tx.pricePerKg ?? '');
    setIsDirectDelivery(tx.isDirectDelivery || false);
    setIsSupplierBuyer(!!tx.supplierId && !tx.isDirectDelivery && !tx.buyerId);
    setManualNetWeight(tx.netWeight ?? '');
    setManualTotalValue(tx.totalValue ?? '');
    setIsAddingSale(true);
  };

  // Load Data from Firestore
  useEffect(() => {
    if (!profile?.companyId) return;

    const qTx = query(
      collection(db, 'transactions'), 
      where('companyId', '==', profile.companyId),
      where('type', '==', 'SALE')
    );
    const unsubscribeTx = onSnapshot(qTx, (snapshot) => {
      const data = snapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id } as Transaction));
      const sorted = data.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      setTransactions(sorted);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'transactions')));

    const qBuyers = query(
      collection(db, 'buyers'), 
      where('companyId', '==', profile.companyId)
    );
    const unsubscribeBuyers = onSnapshot(qBuyers, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Buyer));
      const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
      setBuyers(sorted);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'buyers')));

    const qWarehouses = query(
      collection(db, 'warehouses'), 
      where('companyId', '==', profile.companyId)
    );
    const unsubscribeWarehouses = onSnapshot(qWarehouses, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Warehouse));
      const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
      setWarehouses(sorted);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'warehouses')));

    const qSuppliers = query(
      collection(db, 'suppliers'), 
      where('companyId', '==', profile.companyId)
    );
    const unsubscribeSuppliers = onSnapshot(qSuppliers, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Supplier));
      const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
      setSuppliers(sorted);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'suppliers')));

    const qAll = query(
      collection(db, 'transactions'),
      where('companyId', '==', profile.companyId)
    );
    const unsubscribeAll = onSnapshot(qAll, (snapshot) => {
      const data = snapshot.docs
        .map(doc => doc.data() as Transaction)
        .filter(tx => !tx.isDeleted);
      setAllTransactions(data);
    });

    const qAdjustments = query(
      collection(db, 'inventory_adjustments'), 
      where('companyId', '==', profile.companyId)
    );
    const unsubscribeAdjustments = onSnapshot(qAdjustments, (snapshot) => {
      const data = snapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id } as InventoryAdjustment))
        .filter(adj => !adj.isDeleted);
      setAdjustments(data);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'inventory_adjustments')));

    return () => {
      unsubscribeTx();
      unsubscribeBuyers();
      unsubscribeWarehouses();
      unsubscribeSuppliers();
      unsubscribeAll();
      unsubscribeAdjustments();
    };
  }, [profile?.companyId]);

  // Inventory Summary (Calculated from all transactions and adjustments)
  const inventory = useMemo(() => {
    const summary: Record<string, number> = { COCOA: 0, CASHEW: 0, PK: 0 };
    allTransactions.forEach(tx => {
      const weightKg = getWeightInKg(tx.netWeight);
      if (summary[tx.commodity] === undefined) {
        summary[tx.commodity] = 0;
      }
      if (selectedWarehouseId && selectedWarehouseId !== 'ALL') {
        if (tx.type === 'PURCHASE' && tx.warehouseId === selectedWarehouseId) {
          summary[tx.commodity] += weightKg;
        }
        if (tx.type === 'SALE' && tx.warehouseId === selectedWarehouseId) {
          // Direct delivery bypasses physical warehouse inventory
          if (!tx.isDirectDelivery) {
            summary[tx.commodity] -= weightKg;
          }
        }
        if (tx.type === 'TRANSFER') {
          if (tx.sourceWarehouseId === selectedWarehouseId) summary[tx.commodity] -= weightKg;
          if (tx.destinationWarehouseId === selectedWarehouseId) summary[tx.commodity] += weightKg;
        }
      } else {
        if (tx.type === 'PURCHASE') {
          summary[tx.commodity] += weightKg;
        }
        if (tx.type === 'SALE') {
          // Direct delivery bypasses physical warehouse inventory
          if (!tx.isDirectDelivery) {
            summary[tx.commodity] -= weightKg;
          }
        }
      }
    });

    // Factor in Inventory Adjustments
    adjustments.forEach(adj => {
      if (adj.isDeleted) return;
      if (selectedWarehouseId && selectedWarehouseId !== 'ALL' && adj.warehouseId !== selectedWarehouseId) return;
      const weightSec = adj.netWeight;
      if (summary[adj.commodity] === undefined) {
        summary[adj.commodity] = 0;
      }
      if (adj.adjustmentDirection === 'ADD') {
        summary[adj.commodity] += weightSec;
      } else {
        summary[adj.commodity] -= weightSec;
      }
    });

    return summary;
  }, [allTransactions, adjustments, selectedWarehouseId]);

  // Calculation Logic
  const moistureLoss = useMemo(() => {
    const actual = Number(moistureActual) || 0;
    const benchmark = Number(moistureBenchmark) || 0;
    const gross = Number(grossWeight) || 0;
    return roundTo(((actual - benchmark) * gross) / 100, 2);
  }, [moistureActual, moistureBenchmark, grossWeight]);

  const totalDeductions = roundTo(moistureLoss + Number(tareWeight) + Number(moldWeight) + Number(otherDeduction), 2);
  
  const calculatedNetWeight = useMemo(() => {
    const gross = Number(grossWeight) || 0;
    return Math.max(0, roundTo(gross - totalDeductions, 2));
  }, [grossWeight, totalDeductions]);

  // Sync manual values with calculated values if not manually changed or if there are no manual inputs yet
  useEffect(() => {
    if (
      calculationMethod === 'DIRECT' || 
      !manualNetWeight || 
      manualNetWeight === '0' || 
      manualNetWeight === 0 ||
      !manualTotalValue || 
      manualTotalValue === '0' || 
      manualTotalValue === 0
    ) {
      setManualNetWeight(calculatedNetWeight);
      setManualTotalValue(roundTo(calculatedNetWeight * Number(price), 2));
    }
  }, [calculatedNetWeight, price, calculationMethod]);

  const handleAddBuyer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('handleAddBuyer triggered', { isStaff, submitting, companyId: profile?.companyId });
    if (!isStaff || submitting || !profile?.companyId) {
      console.warn('handleAddBuyer early exit', { isStaff, submitting, companyId: profile?.companyId });
      return;
    }

    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const id = crypto.randomUUID();
    const newBuyer: Buyer = {
      id,
      companyId: profile.companyId,
      name: formData.get('name') as string,
      phone: formData.get('phone') as string,
      location: formData.get('location') as string,
      previousBalance: Number(formData.get('previousBalance')) || 0,
      createdAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'buyers', id), newBuyer);
      setIsAddingBuyer(false);
      setSuccessMessage('Buyer successfully registered!');
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, OperationType.CREATE, `buyers/${id}`));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddSale = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('handleAddSale triggered', { isStaff, submitting, companyId: profile?.companyId });
    if (!isStaff || submitting || !profile?.companyId) {
      console.warn('handleAddSale early exit', { isStaff, submitting, companyId: profile?.companyId });
      return;
    }

    // Check inventory availability (Skip for direct delivery)
    const availableStock = inventory[commodity] + (editingTransaction && editingTransaction.commodity === commodity ? editingTransaction.netWeight : 0);
    
    // Fall back to automatic calculation if manual values are not set or are 0
    const finalNetWeight = calculationMethod === 'MANUAL' 
      ? (Number(manualNetWeight) || calculatedNetWeight) 
      : calculatedNetWeight;
      
    const finalTotalValue = calculationMethod === 'MANUAL' 
      ? (Number(manualTotalValue) || roundTo(finalNetWeight * Number(price), 2)) 
      : roundTo(finalNetWeight * Number(price), 2);

    if (!isDirectDelivery && finalNetWeight > availableStock) {
      setErrorMessage(`Insufficient inventory! Available ${commodity} stock is only ${formatNumber(availableStock || 0)} kg.`);
      return;
    }

    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const id = editingTransaction?.id || crypto.randomUUID();
    
    const newTx: any = {
      id,
      companyId: profile.companyId,
      date: editingTransaction?.date || new Date().toISOString(),
      type: 'SALE',
      commodity,
      buyerId: isSupplierBuyer ? undefined : (formData.get('buyerId') as string),
      storeRecordId: formData.get('storeRecordId') as string,
      supplierId: isSupplierBuyer ? (formData.get('supplierId') as string) : (isDirectDelivery ? (formData.get('supplierId') as string) : undefined),
      isDirectDelivery,
      calculationMethod,
      grossWeight: Number(grossWeight) || 0,
      netWeight: finalNetWeight,
      bags: Number(formData.get('bags')) || 0,
      noOfBags: Number(formData.get('bags')) || 0,
      pricePerKg: Number(price) || 0,
      totalValue: finalTotalValue,
      referenceId: editingTransaction?.referenceId || `SL-${Date.now().toString().slice(-6)}`,
      truckNo: formData.get('truckNo') as string,
      driverName: formData.get('driverName') as string,
      driverPhone: formData.get('driverPhone') as string,
      staffName: formData.get('staffName') as string,
      notes: formData.get('notes') as string,
      deductions: {
        moistureActual: Number(moistureActual) || 0,
        moistureBenchmark: Number(moistureBenchmark) || 0,
        tareWeight: Number(tareWeight) || 0,
        moldWeight: Number(moldWeight) || 0,
        otherDeduction: Number(otherDeduction) || 0
      }
    };

    if (!isDirectDelivery) {
      newTx.warehouseId = selectedWarehouseId === 'ALL' ? (profile?.assignedWarehouseId || '') : selectedWarehouseId;
    }

    // Clean up undefined values
    Object.keys(newTx).forEach(key => newTx[key] === undefined && delete newTx[key]);

    try {
      const writePromise = setDoc(doc(db, 'transactions', id), newTx);
      
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
        action: editingTransaction ? AuditAction.UPDATE : AuditAction.CREATE,
        module: 'Sales',
        recordId: id,
        details: `${editingTransaction ? 'Updated' : 'Created'} sale transaction for ${newTx.commodity} (${newTx.netWeight}kg)`,
        newData: newTx,
        previousData: editingTransaction || undefined
      }).catch(err => console.error('Audit log failed:', err));

      setIsAddingSale(false);
      resetForm();
      setSuccessMessage(editingTransaction ? 'Sale record successfully updated!' : 'Sale record successfully recorded!');
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, editingTransaction ? OperationType.UPDATE : OperationType.CREATE, `transactions/${id}`));
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setEditingTransaction(null);
    setCalculationMethod('DIRECT');
    setGrossWeight('');
    setMoistureActual(8);
    setMoistureBenchmark(BENCHMARKS[commodity]);
    setTareWeight('');
    setMoldWeight('');
    setOtherDeduction('');
    setIsDirectDelivery(false);
    setIsSupplierBuyer(false);
    setPrice('');
    setManualNetWeight('');
    setManualTotalValue('');
  };

  const handleDeleteSale = async (txId: string) => {
    if (!isAdmin) return;
    setDeleteConfirmId(txId);
  };

  const confirmDeleteSale = async (reason?: string) => {
    if (!deleteConfirmId || !profile) return;
    
    try {
      const updateData = {
        isDeleted: true,
        deletionReason: reason || 'No reason provided',
        deletedBy: profile.email,
        deletedAt: new Date().toISOString()
      };

      await updateDoc(doc(db, 'transactions', deleteConfirmId), updateData);
      
      recordAuditLog({
        companyId: profile.companyId,
        userId: profile.uid,
        userEmail: profile.email,
        action: AuditAction.DELETE,
        module: 'Sales',
        recordId: deleteConfirmId,
        details: `Deleted (Soft) sale transaction. Reason: ${reason}`,
        newData: updateData
      }).catch(err => console.error('Audit log failed:', err));

      setSuccessMessage('Sales record removed.');
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, OperationType.UPDATE, `transactions/${deleteConfirmId}`));
    } finally {
      setDeleteConfirmId(null);
    }
  };

  useEffect(() => {
    setMoistureBenchmark(BENCHMARKS[commodity]);
  }, [commodity]);

  const filteredSales = transactions.filter(tx => tx.type === 'SALE' && !tx.isDeleted);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Success Toast */}
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

      <ConfirmModal
        isOpen={!!deleteConfirmId}
        title="Delete Sale Transaction"
        message="Are you sure you want to delete this sale record? It will be hidden from reports but remain in the logs."
        onConfirm={confirmDeleteSale}
        onCancel={() => setDeleteConfirmId(null)}
        confirmText="Delete"
        type="danger"
        requireReason={true}
      />

      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-slate-900">Sales Module</h1>
          <div className="flex gap-2">
            {isStaff && (
              <button
                onClick={() => setIsAddingBuyer(true)}
                className="bg-slate-100 text-slate-600 px-3 py-2 rounded-xl hover:bg-slate-200 transition-all flex items-center gap-2 text-xs font-bold"
                title="Add Buyer"
              >
                <UserPlus size={18} /> Add Buyer
              </button>
            )}
            {canPostTransactions && (
              <button
                onClick={() => setIsAddingSale(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-sm font-bold active:scale-95 transition-all"
              >
                <Plus size={18} /> New Sale
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
        <AnimatePresence mode="wait">
          {isAddingSale ? (
            <motion.div
              key="sale-form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <SaleForm
                profile={profile}
                commodity={commodity}
                setCommodity={setCommodity}
                calculationMethod={calculationMethod}
                setCalculationMethod={setCalculationMethod}
                grossWeight={grossWeight}
                setGrossWeight={setGrossWeight}
                moistureActual={moistureActual}
                setMoistureActual={setMoistureActual}
                moistureBenchmark={moistureBenchmark}
                setMoistureBenchmark={setMoistureBenchmark}
                tareWeight={tareWeight}
                setTareWeight={setTareWeight}
                moldWeight={moldWeight}
                setMoldWeight={setMoldWeight}
                otherDeduction={otherDeduction}
                setOtherDeduction={setOtherDeduction}
                isDirectDelivery={isDirectDelivery}
                setIsDirectDelivery={setIsDirectDelivery}
                isSupplierBuyer={isSupplierBuyer}
                setIsSupplierBuyer={setIsSupplierBuyer}
                selectedWarehouseId={selectedWarehouseId}
                setSelectedWarehouseId={setSelectedWarehouseId}
                warehouses={warehouses}
                suppliers={suppliers}
                buyers={buyers}
                inventory={inventory}
                netWeight={calculationMethod === 'MANUAL' ? Number(manualNetWeight) : calculatedNetWeight}
                price={price}
                setPrice={setPrice}
                manualNetWeight={manualNetWeight}
                setManualNetWeight={setManualNetWeight}
                manualTotalValue={manualTotalValue}
                setManualTotalValue={setManualTotalValue}
                submitting={submitting}
                onSubmit={handleAddSale}
                onCancel={() => { setIsAddingSale(false); resetForm(); }}
                editingTransaction={editingTransaction}
              />
            </motion.div>
          ) : isAddingBuyer ? (
            <motion.div
              key="buyer-form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <BuyerForm
                submitting={submitting}
                onSubmit={handleAddBuyer}
                onCancel={() => setIsAddingBuyer(false)}
              />
            </motion.div>
          ) : (
            <div className="space-y-6">
              <SalesList
                filteredSales={filteredSales}
                buyers={buyers}
                suppliers={suppliers}
                warehouses={warehouses}
                isAdmin={isAdmin}
                onDeleteSale={handleDeleteSale}
                onEditSale={handleEditSaleClick}
              />
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
