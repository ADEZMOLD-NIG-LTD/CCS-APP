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
import { CommodityType, Transaction, Buyer, DeductionParams, Warehouse, Supplier } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, query, orderBy, where, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, reportFirestoreError, formatFirestoreError, OperationType } from '../lib/firestore';
import { recordAuditLog, AuditAction } from '../lib/audit';
import Toast from './Toast';
import { cn, roundTo, formatNumber, formatCurrency } from '../lib/utils';
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

  // Default selected warehouse for staff
  useEffect(() => {
    if (profile?.assignedWarehouseId && !isAdmin) {
      setSelectedWarehouseId(profile.assignedWarehouseId);
    }
  }, [profile, isAdmin, profile?.assignedWarehouseId]);

  // Form State for Sale
  const [commodity, setCommodity] = useState<CommodityType>('COCOA');
  const [grossWeight, setGrossWeight] = useState<number | string>('');
  const [moistureActual, setMoistureActual] = useState<number | string>(8);
  const [moistureBenchmark, setMoistureBenchmark] = useState<number | string>(10);
  const [tareWeight, setTareWeight] = useState<number | string>('');
  const [moldWeight, setMoldWeight] = useState<number | string>('');
  const [otherDeduction, setOtherDeduction] = useState<number | string>('');

  // Load Data from Firestore
  useEffect(() => {
    if (!profile?.companyId) return;

    const qTx = query(
      collection(db, 'transactions'), 
      where('companyId', '==', profile.companyId),
      where('type', '==', 'SALE'), 
      orderBy('date', 'desc')
    );
    const unsubscribeTx = onSnapshot(qTx, (snapshot) => {
      const data = snapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id } as Transaction))
        .filter(tx => !tx.isDeleted);
      setTransactions(data);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'transactions')));

    const qBuyers = query(
      collection(db, 'buyers'), 
      where('companyId', '==', profile.companyId),
      orderBy('name', 'asc')
    );
    const unsubscribeBuyers = onSnapshot(qBuyers, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Buyer));
      setBuyers(data);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'buyers')));

    const qWarehouses = query(
      collection(db, 'warehouses'), 
      where('companyId', '==', profile.companyId),
      orderBy('name', 'asc')
    );
    const unsubscribeWarehouses = onSnapshot(qWarehouses, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Warehouse));
      setWarehouses(data);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'warehouses')));

    const qSuppliers = query(
      collection(db, 'suppliers'), 
      where('companyId', '==', profile.companyId),
      orderBy('name', 'asc')
    );
    const unsubscribeSuppliers = onSnapshot(qSuppliers, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Supplier));
      setSuppliers(data);
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

    return () => {
      unsubscribeTx();
      unsubscribeBuyers();
      unsubscribeWarehouses();
      unsubscribeSuppliers();
      unsubscribeAll();
    };
  }, [profile?.companyId]);

  // Inventory Summary (Calculated from all transactions)
  const inventory = useMemo(() => {
    const summary: Record<CommodityType, number> = { COCOA: 0, CASHEW: 0, PK: 0 };
    allTransactions.forEach(tx => {
      if (selectedWarehouseId) {
        if (tx.type === 'PURCHASE' && tx.warehouseId === selectedWarehouseId) summary[tx.commodity] += tx.netWeight;
        if (tx.type === 'SALE' && tx.warehouseId === selectedWarehouseId) summary[tx.commodity] -= tx.netWeight;
        if (tx.type === 'TRANSFER') {
          if (tx.sourceWarehouseId === selectedWarehouseId) summary[tx.commodity] -= tx.netWeight;
          if (tx.destinationWarehouseId === selectedWarehouseId) summary[tx.commodity] += tx.netWeight;
        }
      } else {
        if (tx.type === 'PURCHASE') summary[tx.commodity] += tx.netWeight;
        if (tx.type === 'SALE') summary[tx.commodity] -= tx.netWeight;
      }
    });
    return summary;
  }, [allTransactions, selectedWarehouseId]);

  // Calculation Logic
  const moistureLoss = useMemo(() => {
    const actual = Number(moistureActual) || 0;
    const benchmark = Number(moistureBenchmark) || 0;
    const gross = Number(grossWeight) || 0;
    return roundTo(((actual - benchmark) * gross) / 100, 2);
  }, [moistureActual, moistureBenchmark, grossWeight]);

  const totalDeductions = roundTo(moistureLoss + Number(tareWeight) + Number(moldWeight) + Number(otherDeduction), 2);
  const netWeight = Math.max(0, roundTo(Number(grossWeight) - totalDeductions, 2));

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
      previousBalance: 0,
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
    const availableStock = inventory[commodity];
    if (!isDirectDelivery && netWeight > availableStock) {
      setErrorMessage(`Insufficient inventory! Available ${commodity} stock is only ${formatNumber(availableStock || 0)} kg.`);
      return;
    }

    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const id = crypto.randomUUID();
    
    const newTx: any = {
      id,
      companyId: profile.companyId,
      date: new Date().toISOString(),
      type: 'SALE',
      commodity,
      buyerId: isSupplierBuyer ? undefined : (formData.get('buyerId') as string),
      storeRecordId: formData.get('storeRecordId') as string,
      supplierId: isSupplierBuyer ? (formData.get('supplierId') as string) : (isDirectDelivery ? (formData.get('supplierId') as string) : undefined),
      isDirectDelivery,
      grossWeight: Number(grossWeight) || 0,
      netWeight,
      bags: Number(formData.get('bags')) || 0,
      noOfBags: Number(formData.get('bags')) || 0,
      pricePerKg: Number(formData.get('price')) || 0,
      totalValue: roundTo(netWeight * (Number(formData.get('price')) || 0), 2),
      referenceId: `SL-${Date.now().toString().slice(-6)}`,
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
        action: AuditAction.CREATE,
        module: 'Sales',
        recordId: id,
        details: `Created sale transaction for ${newTx.commodity} (${newTx.netWeight}kg)`,
        newData: newTx
      }).catch(err => console.error('Audit log failed:', err));

      setIsAddingSale(false);
      resetForm();
      setSuccessMessage('Sale record successfully recorded!');
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, OperationType.CREATE, `transactions/${id}`));
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setGrossWeight('');
    setMoistureActual(8);
    setMoistureBenchmark(BENCHMARKS[commodity]);
    setTareWeight('');
    setMoldWeight('');
    setOtherDeduction('');
    setIsDirectDelivery(false);
  };

  const handleDeleteSale = async (txId: string) => {
    if (!isAdmin) return;
    if (!window.confirm('Are you sure you want to remove this sales record? This action will be logged and cannot be undone.')) return;

    try {
      await updateDoc(doc(db, 'transactions', txId), { isDeleted: true });
      setSuccessMessage('Sales record removed.');
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, OperationType.UPDATE, `transactions/${txId}`));
    }
  };

  useEffect(() => {
    setMoistureBenchmark(BENCHMARKS[commodity]);
  }, [commodity]);

  const filteredSales = transactions.filter(tx => tx.type === 'SALE');

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
                netWeight={netWeight}
                submitting={submitting}
                onSubmit={handleAddSale}
                onCancel={() => setIsAddingSale(false)}
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
              />
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
