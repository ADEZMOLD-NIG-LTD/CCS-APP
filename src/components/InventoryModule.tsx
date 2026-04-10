/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Package, ArrowRightLeft, ArrowLeftRight, X, History, Calculator, Warehouse as WarehouseIcon, Scale, Droplets, Trash2, AlertCircle, Edit } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CommodityType, PackagingType, Transaction, BagTransaction, Supplier, InventoryItem, DeductionParams, Warehouse } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, query, orderBy, where, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, reportFirestoreError, formatFirestoreError, OperationType } from '../lib/firestore';
import { recordAuditLog, AuditAction } from '../lib/audit';
import Toast from './Toast';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const COMMODITIES: CommodityType[] = ['COCOA', 'CASHEW', 'PK'];
const PACKAGING: PackagingType[] = ['JUTE_BAG', 'NYLON_BAG'];
const BENCHMARKS = { COCOA: 8, CASHEW: 10, PK: 8 };

export default function InventoryModule() {
  const { profile, isStaff, isAdmin, canTransferStock, canPostTransactions } = useAuth();
  const [activeTab, setActiveTab] = useState<'COMMODITIES' | 'PACKAGING'>('COMMODITIES');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bagTransactions, setBagTransactions] = useState<BagTransaction[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [isTransferringBag, setIsTransferringBag] = useState(false);
  const [isAddingBag, setIsAddingBag] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [transferSourceId, setTransferSourceId] = useState<string>('');
  const [transferCommodity, setTransferCommodity] = useState<CommodityType>('COCOA');
  const [transferBagSourceId, setTransferBagSourceId] = useState<string>('');
  const [transferBagType, setTransferBagType] = useState<PackagingType>('JUTE_BAG');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('ALL');

  // Default selected warehouse for staff
  useEffect(() => {
    if (profile?.assignedWarehouseId && !isAdmin) {
      setSelectedWarehouseId(profile.assignedWarehouseId);
    }
  }, [profile, isAdmin]);

  // Success message auto-hide
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);
  
  // Form State
  const [commodity, setCommodity] = useState<CommodityType>('COCOA');
  const [packagingType, setPackagingType] = useState<PackagingType>('JUTE_BAG');
  const [bagOpType, setBagOpType] = useState<'STOCK_IN' | 'ISSUE'>('STOCK_IN');
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
      where('type', '==', 'PURCHASE'), 
      orderBy('date', 'desc')
    );
    const unsubscribeTx = onSnapshot(qTx, (snapshot) => {
      const data = snapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id } as Transaction))
        .filter(tx => !tx.isDeleted);
      setTransactions(data);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'transactions')));

    const qSuppliers = query(
      collection(db, 'suppliers'), 
      where('companyId', '==', profile.companyId),
      orderBy('name', 'asc')
    );
    const unsubscribeSuppliers = onSnapshot(qSuppliers, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Supplier));
      setSuppliers(data);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'suppliers')));

    const qWarehouses = query(
      collection(db, 'warehouses'), 
      where('companyId', '==', profile.companyId),
      orderBy('name', 'asc')
    );
    const unsubscribeWarehouses = onSnapshot(qWarehouses, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Warehouse));
      setWarehouses(data);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'warehouses')));

    const qBags = query(
      collection(db, 'bag_transactions'), 
      where('companyId', '==', profile.companyId),
      orderBy('date', 'desc')
    );
    const unsubscribeBags = onSnapshot(qBags, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as BagTransaction));
      setBagTransactions(data);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'bag_transactions')));

    return () => {
      unsubscribeTx();
      unsubscribeSuppliers();
      unsubscribeWarehouses();
      unsubscribeBags();
    };
  }, [profile?.companyId]);

  // Calculation Logic
  const moistureLoss = useMemo(() => {
    const actual = Number(moistureActual) || 0;
    const benchmark = Number(moistureBenchmark) || 0;
    const gross = Number(grossWeight) || 0;
    return ((actual - benchmark) * gross) / 100;
  }, [moistureActual, moistureBenchmark, grossWeight]);

  const totalDeductions = moistureLoss + Number(tareWeight) + Number(moldWeight) + Number(otherDeduction);
  const netWeight = Math.max(0, Number(grossWeight) - totalDeductions);

  // Inventory Summary (Calculated from all transactions)
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  useEffect(() => {
    if (!profile?.companyId) return;

    const qAll = query(
      collection(db, 'transactions'),
      where('companyId', '==', profile.companyId)
    );
    const unsubscribe = onSnapshot(qAll, (snapshot) => {
      const data = snapshot.docs
        .map(doc => doc.data() as Transaction)
        .filter(tx => !tx.isDeleted);
      setAllTransactions(data);
    });
    return () => unsubscribe();
  }, [profile?.companyId]);

  const inventory = useMemo(() => {
    const summary: Record<CommodityType, number> = { COCOA: 0, CASHEW: 0, PK: 0 };
    allTransactions.forEach(tx => {
      if (selectedWarehouseId !== 'ALL') {
        if (tx.type === 'PURCHASE' && tx.warehouseId === selectedWarehouseId) summary[tx.commodity] += tx.netWeight;
        if (tx.type === 'SALE' && tx.warehouseId === selectedWarehouseId) summary[tx.commodity] -= tx.netWeight;
        if (tx.type === 'TRANSFER') {
          if (tx.sourceWarehouseId === selectedWarehouseId) summary[tx.commodity] -= tx.netWeight;
          if (tx.destinationWarehouseId === selectedWarehouseId) summary[tx.commodity] += tx.netWeight;
        }
      } else {
        if (tx.type === 'PURCHASE') summary[tx.commodity] += tx.netWeight;
        if (tx.type === 'SALE') summary[tx.commodity] -= tx.netWeight;
        // Transfers don't change total inventory, only location
      }
    });
    return summary;
  }, [allTransactions, selectedWarehouseId]);

  const packagingInventory = useMemo(() => {
    const summary: Record<PackagingType, number> = { JUTE_BAG: 0, NYLON_BAG: 0 };
    bagTransactions.forEach(tx => {
      if (tx.type === 'TRANSFER') {
        if (selectedWarehouseId === 'ALL') return;
        if (tx.sourceWarehouseId === selectedWarehouseId) summary[tx.packagingType] -= tx.quantity;
        if (tx.destinationWarehouseId === selectedWarehouseId) summary[tx.packagingType] += tx.quantity;
      } else {
        if (selectedWarehouseId !== 'ALL' && tx.warehouseId !== selectedWarehouseId) return;
        if (tx.type === 'STOCK_IN' || tx.type === 'RETURN') summary[tx.packagingType] += tx.quantity;
        if (tx.type === 'ISSUE') summary[tx.packagingType] -= tx.quantity;
      }
    });
    return summary;
  }, [bagTransactions, selectedWarehouseId]);

  const getWarehouseStock = (warehouseId: string, commodityType: CommodityType) => {
    return allTransactions.reduce((sum, tx) => {
      if (tx.commodity !== commodityType) return sum;
      if (tx.type === 'PURCHASE' && tx.warehouseId === warehouseId) return sum + tx.netWeight;
      if (tx.type === 'SALE' && tx.warehouseId === warehouseId) return sum - tx.netWeight;
      if (tx.type === 'TRANSFER') {
        if (tx.sourceWarehouseId === warehouseId) return sum - tx.netWeight;
        if (tx.destinationWarehouseId === warehouseId) return sum + tx.netWeight;
      }
      return sum;
    }, 0);
  };

  const getWarehouseBagStock = (warehouseId: string, pkgType: PackagingType) => {
    return bagTransactions.reduce((sum, tx) => {
      if (tx.packagingType !== pkgType) return sum;
      if (tx.type === 'TRANSFER') {
        if (tx.sourceWarehouseId === warehouseId) return sum - tx.quantity;
        if (tx.destinationWarehouseId === warehouseId) return sum + tx.quantity;
      } else {
        if (tx.warehouseId !== warehouseId) return sum;
        if (tx.type === 'STOCK_IN' || tx.type === 'RETURN') return sum + tx.quantity;
        if (tx.type === 'ISSUE') return sum - tx.quantity;
      }
      return sum;
    }, 0);
  };

  const handleAddEntry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('handleAddEntry triggered', { isStaff, submitting, companyId: profile?.companyId });
    if (submitting || !profile?.companyId) {
      console.warn('handleAddEntry early exit', { submitting, companyId: profile?.companyId });
      return;
    }

    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const id = crypto.randomUUID();
    
    const newTx: any = {
      id: editingTransaction?.id || id,
      companyId: profile.companyId,
      date: editingTransaction?.date || new Date().toISOString(),
      type: 'PURCHASE',
      commodity,
      supplierId: formData.get('supplierId') as string,
      storeRecordId: formData.get('storeRecordId') as string,
      grossWeight: Number(grossWeight) || 0,
      netWeight,
      bags: Number(formData.get('bags')) || 0,
      noOfBags: Number(formData.get('bags')) || 0,
      pricePerKg: Number(formData.get('price')) || 0,
      totalValue: netWeight * (Number(formData.get('price')) || 0),
      referenceId: editingTransaction?.referenceId || `TX-${Date.now().toString().slice(-6)}`,
      warehouseId: (formData.get('warehouseId') as string) || profile?.assignedWarehouseId || '',
      deductions: {
        moistureActual: Number(moistureActual) || 0,
        moistureBenchmark: Number(moistureBenchmark) || 0,
        tareWeight: Number(tareWeight) || 0,
        moldWeight: Number(moldWeight) || 0,
        otherDeduction: Number(otherDeduction) || 0
      }
    };

    // Clean up undefined values
    Object.keys(newTx).forEach(key => newTx[key] === undefined && delete newTx[key]);

    try {
      await setDoc(doc(db, 'transactions', newTx.id), newTx);
      
      // Record Audit Log
      await recordAuditLog({
        companyId: profile.companyId,
        userId: profile.uid,
        userEmail: profile.email,
        action: editingTransaction ? AuditAction.UPDATE : AuditAction.CREATE,
        module: 'Inventory (Purchase)',
        recordId: newTx.id,
        details: `${editingTransaction ? 'Updated' : 'Created'} purchase transaction for ${newTx.commodity} (${newTx.netWeight}kg)`,
        newData: newTx,
        previousData: editingTransaction || undefined
      });

      setIsAdding(false);
      setEditingTransaction(null);
      resetForm();
      setSuccessMessage(editingTransaction ? 'Purchase record updated!' : 'Purchase record successfully updated!');
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, editingTransaction ? OperationType.UPDATE : OperationType.CREATE, `transactions/${newTx.id}`));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddBagEntry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isStaff || submitting || !profile?.companyId) return;

    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const id = crypto.randomUUID();
    
    const newTx: any = {
      id,
      companyId: profile.companyId,
      date: new Date().toISOString(),
      type: bagOpType,
      packagingType,
      quantity: Number(formData.get('quantity')) || 0,
      reference: (formData.get('reference') as string) || `BAG-${Date.now().toString().slice(-6)}`,
      warehouseId: (formData.get('warehouseId') as string) || profile?.assignedWarehouseId || '',
    };

    const supplierId = formData.get('supplierId') as string;
    if (supplierId) {
      newTx.supplierId = supplierId;
    }

    // Clean up undefined values
    Object.keys(newTx).forEach(key => newTx[key] === undefined && delete newTx[key]);

    if (bagOpType === 'ISSUE') {
      if (!newTx.supplierId) {
        setErrorMessage('Supplier is required for bag issuance.');
        setSubmitting(false);
        return;
      }
      
      // Check stock availability
      const currentStock = getWarehouseBagStock(newTx.warehouseId, packagingType);
      if (newTx.quantity > currentStock) {
        setErrorMessage(`Insufficient ${packagingType.replace('_', ' ')} stock. Available: ${currentStock.toLocaleString()} units`);
        setSubmitting(false);
        return;
      }
    }

    try {
      await setDoc(doc(db, 'bag_transactions', id), newTx);
      setIsAddingBag(false);
      setSuccessMessage(`${packagingType.replace('_', ' ')} ${bagOpType === 'STOCK_IN' ? 'Stock-in' : 'Issuance'} recorded!`);
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, OperationType.CREATE, `bag_transactions/${id}`));
    } finally {
      setSubmitting(false);
    }
  };

  const handleBagTransfer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isStaff || submitting || !profile?.companyId) return;

    const formData = new FormData(e.currentTarget);
    const sourceId = formData.get('sourceWarehouseId') as string;
    const destId = formData.get('destinationWarehouseId') as string;
    const pkgType = formData.get('packagingType') as PackagingType;
    const quantity = Number(formData.get('quantity'));

    if (sourceId === destId) {
      setErrorMessage('Source and destination warehouses must be different.');
      return;
    }

    // Check source stock
    const sourceStock = bagTransactions.reduce((sum, tx) => {
      if (tx.packagingType !== pkgType) return sum;
      if (tx.type === 'TRANSFER') {
        if (tx.sourceWarehouseId === sourceId) return sum - tx.quantity;
        if (tx.destinationWarehouseId === sourceId) return sum + tx.quantity;
      } else {
        if (tx.warehouseId !== sourceId) return sum;
        if (tx.type === 'STOCK_IN' || tx.type === 'RETURN') return sum + tx.quantity;
        if (tx.type === 'ISSUE') return sum - tx.quantity;
      }
      return sum;
    }, 0);

    if (quantity > sourceStock) {
      setErrorMessage(`Insufficient stock in source warehouse. Available: ${(sourceStock || 0).toLocaleString()} units`);
      return;
    }

    setSubmitting(true);
    const id = crypto.randomUUID();
    const transferTx: any = {
      id,
      companyId: profile.companyId,
      date: new Date().toISOString(),
      type: 'TRANSFER',
      packagingType: pkgType,
      sourceWarehouseId: sourceId,
      destinationWarehouseId: destId,
      quantity,
      reference: (formData.get('reference') as string) || `BTR-${Date.now().toString().slice(-6)}`,
    };

    // Clean up undefined values
    Object.keys(transferTx).forEach(key => transferTx[key] === undefined && delete transferTx[key]);

    try {
      await setDoc(doc(db, 'bag_transactions', id), transferTx);
      setIsTransferringBag(false);
      setSuccessMessage(`${pkgType.replace('_', ' ')} transfer recorded!`);
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, OperationType.CREATE, `bag_transactions/${id}`));
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isStaff || submitting || !profile?.companyId) return;

    const formData = new FormData(e.currentTarget);
    const sourceId = formData.get('sourceWarehouseId') as string;
    const destId = formData.get('destinationWarehouseId') as string;
    const commodityType = formData.get('commodity') as CommodityType;
    const weight = Number(formData.get('weight'));
    const bags = Number(formData.get('bags'));

    if (sourceId === destId) {
      setErrorMessage('Source and destination warehouses must be different.');
      return;
    }

    // Check source stock
    const sourceStock = allTransactions.reduce((sum, tx) => {
      if (tx.commodity !== commodityType) return sum;
      if (tx.type === 'PURCHASE' && tx.warehouseId === sourceId) return sum + tx.netWeight;
      if (tx.type === 'SALE' && tx.warehouseId === sourceId) return sum - tx.netWeight;
      if (tx.type === 'TRANSFER') {
        if (tx.sourceWarehouseId === sourceId) return sum - tx.netWeight;
        if (tx.destinationWarehouseId === sourceId) return sum + tx.netWeight;
      }
      return sum;
    }, 0);

    if (weight > sourceStock) {
      setErrorMessage(`Insufficient stock in source warehouse. Available: ${sourceStock.toFixed(2)}kg`);
      return;
    }

    setSubmitting(true);
    const id = crypto.randomUUID();
    const transferTx: any = {
      id,
      companyId: profile.companyId,
      date: new Date().toISOString(),
      type: 'TRANSFER',
      commodity: commodityType,
      sourceWarehouseId: sourceId,
      destinationWarehouseId: destId,
      grossWeight: weight,
      netWeight: weight,
      bags,
      noOfBags: bags,
      referenceId: `TR-${Date.now().toString().slice(-6)}`,
      deductions: {
        moistureActual: 0,
        moistureBenchmark: 0,
        tareWeight: 0,
        moldWeight: 0,
        otherDeduction: 0
      }
    };

    // Clean up undefined values
    Object.keys(transferTx).forEach(key => transferTx[key] === undefined && delete transferTx[key]);

    try {
      await setDoc(doc(db, 'transactions', id), transferTx);
      setIsTransferring(false);
      setSuccessMessage('Stock transfer completed successfully!');
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
    setEditingTransaction(null);
  };

  const handleEditClick = (tx: Transaction) => {
    setEditingTransaction(tx);
    setCommodity(tx.commodity);
    setGrossWeight(tx.grossWeight);
    setMoistureActual(tx.deductions.moistureActual);
    setMoistureBenchmark(tx.deductions.moistureBenchmark);
    setTareWeight(tx.deductions.tareWeight);
    setMoldWeight(tx.deductions.moldWeight);
    setOtherDeduction(tx.deductions.otherDeduction);
    setIsAdding(true);
  };

  const handleDeleteEntry = async (txId: string) => {
    if (!isAdmin) return;
    if (!window.confirm('Are you sure you want to remove this purchase record? This action will be logged and cannot be undone.')) return;

    try {
      await updateDoc(doc(db, 'transactions', txId), { isDeleted: true });
      setSuccessMessage('Purchase record removed.');
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, OperationType.UPDATE, `transactions/${txId}`));
    }
  };

  useEffect(() => {
    setMoistureBenchmark(BENCHMARKS[commodity]);
  }, [commodity]);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-app)]">
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

      <header className="bg-white border-b border-[var(--border)] px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-bold text-[var(--text-primary)] shrink-0">Inventory</h1>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {activeTab === 'COMMODITIES' ? (
              <>
                {canTransferStock && (
                  <button
                    onClick={() => setIsTransferring(true)}
                    className="google-btn-secondary flex items-center gap-2 shrink-0"
                  >
                    <ArrowRightLeft size={18} /> <span>Transfer</span>
                  </button>
                )}
                {canPostTransactions && (
                  <button
                    onClick={() => setIsAdding(true)}
                    className="google-btn-primary flex items-center gap-2 shrink-0"
                  >
                    <Plus size={18} /> <span>New Entry</span>
                  </button>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2">
                {canTransferStock && (
                  <button
                    onClick={() => {
                      setIsTransferringBag(true);
                      setIsAddingBag(false);
                    }}
                    className="google-btn-secondary flex items-center gap-2 shrink-0"
                  >
                    <ArrowRightLeft size={18} /> <span>Transfer</span>
                  </button>
                )}
                {canPostTransactions && (
                  <button
                    onClick={() => {
                      setIsAddingBag(true);
                      setIsTransferringBag(false);
                    }}
                    className="google-btn-primary flex items-center gap-2 shrink-0"
                  >
                    <Plus size={18} /> <span>New Bag Entry</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
        {/* Tab Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('COMMODITIES')}
            className={cn(
              "flex-1 py-2 rounded-lg text-xs font-bold transition-all",
              activeTab === 'COMMODITIES' ? "bg-white text-[var(--accent)] shadow-sm" : "text-[var(--text-secondary)]"
            )}
          >
            Commodities
          </button>
          <button
            onClick={() => setActiveTab('PACKAGING')}
            className={cn(
              "flex-1 py-2 rounded-lg text-xs font-bold transition-all",
              activeTab === 'PACKAGING' ? "bg-white text-[var(--accent)] shadow-sm" : "text-[var(--text-secondary)]"
            )}
          >
            Packaging (Bags)
          </button>
        </div>
        <AnimatePresence mode="wait">
          {isAdding || editingTransaction ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="google-card p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold">{editingTransaction ? 'Adjust Purchase Entry' : 'New Purchase Entry'}</h2>
                <button onClick={() => { setIsAdding(false); setEditingTransaction(null); }} className="text-slate-400">Cancel</button>
              </div>

              <form onSubmit={handleAddEntry} className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Warehouse</label>
                    <select 
                      name="warehouseId" 
                      required 
                      defaultValue={editingTransaction?.warehouseId || profile?.assignedWarehouseId || ''}
                      disabled={!!profile?.assignedWarehouseId && profile?.role === 'STAFF'}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                    >
                      <option value="" disabled>Select Warehouse</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Supplier</label>
                    <select name="supplierId" required defaultValue={editingTransaction?.supplierId || ''} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500">
                      <option value="">Select Supplier</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Store Record ID (Tranx ID)</label>
                    <input 
                      name="storeRecordId" 
                      type="text" 
                      defaultValue={editingTransaction?.storeRecordId || ''} 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" 
                      placeholder="Quote Tranx ID from Store Keeper" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Commodity</label>
                    <select 
                      value={commodity} 
                      onChange={(e) => setCommodity(e.target.value as CommodityType)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                    >
                      {COMMODITIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">No of Bags</label>
                    <input name="bags" type="number" defaultValue={editingTransaction?.bags || 0} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="0" />
                  </div>
                </div>

                {/* Weight & Price */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Gross Weight (kg)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      required 
                      value={grossWeight} 
                      onChange={(e) => setGrossWeight(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-lg" 
                      placeholder="0.00" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Price per kg (₦)</label>
                    <input name="price" type="number" step="0.01" required defaultValue={editingTransaction?.pricePerKg || 0} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-lg" placeholder="0.00" />
                  </div>
                </div>

                {/* Deduction Logic Section */}
                <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 space-y-4">
                  <h3 className="text-xs font-bold text-amber-800 flex items-center gap-2">
                    <Calculator size={14} /> Deduction Parameters
                  </h3>
                  
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-amber-600 uppercase mb-1">Actual Moisture (%)</label>
                        <div className="relative">
                          <Droplets className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400" size={14} />
                          <input 
                            type="number" 
                            step="0.1" 
                            value={moistureActual} 
                            onChange={(e) => setMoistureActual(e.target.value)}
                            className="w-full pl-8 pr-4 py-2 bg-white border border-amber-200 rounded-lg outline-none text-sm" 
                            placeholder="0.0"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-amber-600 uppercase mb-1">Benchmark (%)</label>
                        <input 
                          type="number" 
                          step="0.1" 
                          value={moistureBenchmark} 
                          onChange={(e) => setMoistureBenchmark(e.target.value)}
                          className="w-full px-4 py-2 bg-white border border-amber-200 rounded-lg outline-none text-sm" 
                          placeholder="0.0"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-amber-600 uppercase mb-1">TARE (kg)</label>
                      <div className="relative">
                        <Scale className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400" size={14} />
                        <input 
                          type="number" 
                          step="0.1" 
                          value={tareWeight} 
                          onChange={(e) => setTareWeight(e.target.value)}
                          className="w-full pl-8 pr-4 py-2 bg-white border border-amber-200 rounded-lg outline-none text-sm" 
                          placeholder="0.0"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-amber-600 uppercase mb-1">Mold/Quality (kg)</label>
                      <input 
                        type="number" 
                        step="0.1" 
                        value={moldWeight} 
                        onChange={(e) => setMoldWeight(e.target.value)}
                        className="w-full px-4 py-2 bg-white border border-amber-200 rounded-lg outline-none text-sm" 
                        placeholder="0.0"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-amber-600 uppercase mb-1">Other (kg)</label>
                      <input 
                        type="number" 
                        step="0.1" 
                        value={otherDeduction} 
                        onChange={(e) => setOtherDeduction(e.target.value)}
                        className="w-full px-4 py-2 bg-white border border-amber-200 rounded-lg outline-none text-sm" 
                        placeholder="0.0"
                      />
                    </div>
                  </div>

                  {/* Dynamic Calculation Summary */}
                  <div className="pt-3 border-t border-amber-200 grid grid-cols-2 gap-2 text-[11px]">
                    <div className="flex justify-between text-amber-700">
                      <span>Moisture Loss:</span>
                      <span className="font-bold">-{moistureLoss.toFixed(2)} kg</span>
                    </div>
                    <div className="flex justify-between text-amber-700">
                      <span>Manual Deductions:</span>
                      <span className="font-bold">-{(Number(tareWeight) + Number(moldWeight) + Number(otherDeduction)).toFixed(2)} kg</span>
                    </div>
                  </div>
                </div>

                {/* Final Result */}
                <div className="bg-emerald-600 rounded-2xl p-4 text-white flex justify-between items-center shadow-lg">
                  <div>
                    <p className="text-[10px] uppercase font-bold opacity-80">Final Net Weight</p>
                    <p className="text-2xl font-black">{netWeight.toFixed(2)} <span className="text-sm font-normal">kg</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-bold opacity-80">Total Deductions</p>
                    <p className="text-lg font-bold">-{totalDeductions.toFixed(2)} kg</p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? 'Confirming...' : 'Confirm Purchase'}
                </button>
              </form>
            </motion.div>
          ) : isTransferringBag ? (
            <motion.div
              key="bag-transfer-form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl p-6 shadow-xl border border-slate-200"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <ArrowLeftRight className="text-amber-600" /> Bag Transfer
                </h2>
                <button onClick={() => setIsTransferringBag(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleBagTransfer} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bag Type</label>
                    <select 
                      name="packagingType" 
                      required 
                      value={transferBagType}
                      onChange={(e) => setTransferBagType(e.target.value as PackagingType)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                    >
                      {PACKAGING.map(p => <option key={p} value={p}>{p.replace('_', ' ')}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">From Warehouse</label>
                    <select 
                      name="sourceWarehouseId" 
                      required 
                      value={transferBagSourceId}
                      onChange={(e) => setTransferBagSourceId(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                    >
                      <option value="">Select Source</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  {transferBagSourceId && (
                    <div className="col-span-2 bg-amber-50 p-3 rounded-xl border border-amber-100">
                      <p className="text-[10px] font-bold text-amber-600 uppercase mb-1">Available Stock in Source</p>
                      <p className="text-lg font-black text-amber-700">
                        {(getWarehouseBagStock(transferBagSourceId, transferBagType) || 0).toLocaleString()} units
                      </p>
                    </div>
                  )}
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">To Warehouse</label>
                    <select name="destinationWarehouseId" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none">
                      <option value="">Select Destination</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Quantity (Units)</label>
                    <input name="quantity" type="number" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="0" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Reference (Optional)</label>
                    <input name="reference" type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="e.g. Transfer ID" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-amber-600 text-white py-4 rounded-xl font-bold shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Processing...' : 'Confirm Transfer'}
                </button>
              </form>
            </motion.div>
          ) : isAddingBag ? (
            <motion.div
              key="bag-form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold">New Bag Transaction</h2>
                <button onClick={() => setIsAddingBag(false)} className="text-slate-400">Cancel</button>
              </div>

              <form onSubmit={handleAddBagEntry} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Transaction Type</label>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setBagOpType('STOCK_IN')}
                        className={cn(
                          "flex-1 py-2 rounded-lg text-xs font-bold transition-all",
                          bagOpType === 'STOCK_IN' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                        )}
                      >
                        Stock-In
                      </button>
                      <button
                        type="button"
                        onClick={() => setBagOpType('ISSUE')}
                        className={cn(
                          "flex-1 py-2 rounded-lg text-xs font-bold transition-all",
                          bagOpType === 'ISSUE' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                        )}
                      >
                        Issuance
                      </button>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Warehouse</label>
                    <select 
                      name="warehouseId" 
                      required 
                      defaultValue={profile?.assignedWarehouseId || ''}
                      disabled={!!profile?.assignedWarehouseId && profile?.role === 'STAFF'}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none disabled:opacity-50"
                    >
                      <option value="">Select Warehouse</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bag Type</label>
                    <select 
                      value={packagingType} 
                      onChange={(e) => setPackagingType(e.target.value as PackagingType)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                    >
                      {PACKAGING.map(p => <option key={p} value={p}>{p.replace('_', ' ')}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Quantity (Units)</label>
                    <input name="quantity" type="number" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="0" />
                  </div>

                  {bagOpType === 'ISSUE' && (
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Supplier (Required for Issuance)</label>
                      <select name="supplierId" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none">
                        <option value="">Select Supplier</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.location})</option>)}
                      </select>
                    </div>
                  )}

                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Reference (Optional)</label>
                    <input name="reference" type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="e.g. Batch # or Waybill" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-amber-600 text-white py-4 rounded-xl font-bold shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Recording...' : `Confirm ${bagOpType === 'STOCK_IN' ? 'Stock-In' : 'Issuance'}`}
                </button>
              </form>
            </motion.div>
          ) : isTransferring ? (
            <motion.div
              key="transfer-form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold">Stock Transfer</h2>
                <button onClick={() => setIsTransferring(false)} className="text-slate-400">Cancel</button>
              </div>

              <form onSubmit={handleTransfer} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Commodity</label>
                    <select 
                      name="commodity" 
                      required 
                      value={transferCommodity}
                      onChange={(e) => setTransferCommodity(e.target.value as CommodityType)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {COMMODITIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Source Warehouse</label>
                    <select 
                      name="sourceWarehouseId" 
                      required 
                      value={transferSourceId}
                      onChange={(e) => setTransferSourceId(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Source</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Destination Warehouse</label>
                    <select name="destinationWarehouseId" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="">Destination</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  {transferSourceId && (
                    <div className="col-span-2 bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                      <p className="text-[10px] font-bold text-indigo-600 uppercase mb-1">Available Stock in Source</p>
                      <p className="text-lg font-black text-indigo-700">
                        {(getWarehouseStock(transferSourceId, transferCommodity) || 0).toLocaleString()} kg
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Weight (kg)</label>
                    <input name="weight" type="number" step="0.01" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bags Count</label>
                    <input name="bags" type="number" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? 'Transferring...' : 'Complete Transfer'}
                </button>
              </form>
            </motion.div>
          ) : (
            <div className="space-y-6">
              {/* Warehouse Filter */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
                <button
                  onClick={() => setSelectedWarehouseId('ALL')}
                  className={cn(
                    "px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all",
                    selectedWarehouseId === 'ALL' ? "bg-[var(--text-primary)] text-white" : "bg-white text-[var(--text-secondary)] border border-[var(--border)]"
                  )}
                >
                  All Warehouses
                </button>
                {warehouses.map(w => (
                  <button
                    key={w.id}
                    onClick={() => setSelectedWarehouseId(w.id)}
                    className={cn(
                      "px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all",
                      selectedWarehouseId === w.id ? "bg-[var(--accent)] text-white" : "bg-white text-[var(--text-secondary)] border border-[var(--border)]"
                    )}
                  >
                    {w.name}
                  </button>
                ))}
              </div>
              {/* Stock Overview Cards */}
              <div className="grid grid-cols-3 gap-3">
                {activeTab === 'COMMODITIES' ? (
                  COMMODITIES.map(c => (
                    <div key={c} className="google-card p-3 text-center">
                      <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase mb-1">{c}</p>
                      <p className="text-sm font-bold text-[var(--text-primary)]">{(inventory[c] || 0).toLocaleString()} kg</p>
                    </div>
                  ))
                ) : (
                  PACKAGING.map(p => (
                    <div key={p} className="google-card p-3 text-center">
                      <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase mb-1">{p.replace('_', ' ')}</p>
                      <p className="text-sm font-bold text-[var(--text-primary)]">{(packagingInventory[p] || 0).toLocaleString()} pcs</p>
                    </div>
                  ))
                )}
              </div>

              {/* Recent Transactions */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <History size={16} /> {activeTab === 'COMMODITIES' ? 'Recent Purchases' : 'Recent Bag Activity'}
                  </h2>
                </div>

                <div className="space-y-3">
                  {activeTab === 'COMMODITIES' ? (
                    transactions.length === 0 ? (
                      <div className="bg-white rounded-2xl p-8 border border-dashed border-slate-300 text-center">
                        <Package className="mx-auto text-slate-200 mb-2" size={32} />
                        <p className="text-xs text-slate-400">No transactions recorded yet</p>
                      </div>
                    ) : (
                      transactions.map(tx => (
                        <div key={tx.id} className="google-card p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-bold bg-blue-50 text-[var(--accent)] px-2 py-0.5 rounded uppercase">
                                  {tx.commodity}
                                </span>
                                <span className="text-[10px] font-bold bg-slate-100 text-[var(--text-secondary)] px-2 py-0.5 rounded uppercase">
                                  {warehouses.find(w => w.id === tx.warehouseId)?.name || 'Main'}
                                </span>
                                <span className="text-[10px] text-[var(--text-secondary)]">{tx.date ? new Date(tx.date).toLocaleDateString() : 'N/A'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold text-[var(--text-primary)]">
                                  {suppliers.find(s => s.id === tx.supplierId)?.name || 'Unknown Supplier'}
                                </h3>
                                {isAdmin && (
                                  <div className="flex items-center gap-1">
                                    <button 
                                      onClick={() => handleEditClick(tx)}
                                      className="p-1 text-slate-400 hover:text-[var(--accent)] transition-colors"
                                      title="Adjust Purchase"
                                    >
                                      <Edit size={14} />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteEntry(tx.id)}
                                      className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                                      title="Remove Purchase"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-[var(--text-primary)]">{tx.netWeight.toFixed(2)} kg</p>
                              <p className="text-[10px] text-[var(--text-secondary)]">Net Weight</p>
                              {tx.storeRecordId && (
                                <p className="text-[9px] font-bold text-indigo-600 mt-1">
                                  Store ID: {tx.storeRecordId}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-50">
                            <div className="text-center">
                              <p className="text-[9px] text-[var(--text-secondary)] uppercase">Gross</p>
                              <p className="text-[11px] font-bold">{tx.grossWeight}kg</p>
                            </div>
                            <div className="text-center">
                              <p className="text-[9px] text-[var(--text-secondary)] uppercase">Deductions</p>
                              <p className="text-[11px] font-bold text-rose-500">
                                -{(tx.grossWeight - tx.netWeight).toFixed(1)}kg
                              </p>
                              {tx.deductions && (
                                <div className="mt-1 flex flex-wrap gap-1 text-[7px] font-bold uppercase tracking-tighter justify-center text-[var(--text-secondary)]">
                                  {((tx.deductions.moistureActual - tx.deductions.moistureBenchmark) * (tx.grossWeight || 0) / 100) > 0 && (
                                    <span>M: {(((tx.deductions.moistureActual - tx.deductions.moistureBenchmark) * (tx.grossWeight || 0)) / 100).toFixed(1)}kg</span>
                                  )}
                                  {tx.deductions.tareWeight > 0 && <span>T: {tx.deductions.tareWeight}kg</span>}
                                  {tx.deductions.moldWeight > 0 && <span>Q: {tx.deductions.moldWeight}kg</span>}
                                  {tx.deductions.otherDeduction > 0 && <span>O: {tx.deductions.otherDeduction}kg</span>}
                                </div>
                              )}
                            </div>
                            <div className="text-center">
                              <p className="text-[9px] text-[var(--text-secondary)] uppercase">Value</p>
                              <p className="text-[11px] font-bold text-emerald-600">₦{(tx.totalValue || 0).toLocaleString()}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )
                  ) : (
                    bagTransactions.length === 0 ? (
                      <div className="bg-white rounded-2xl p-8 border border-dashed border-slate-300 text-center">
                        <Package className="mx-auto text-slate-200 mb-2" size={32} />
                        <p className="text-xs text-slate-400">No bag transactions recorded yet</p>
                      </div>
                    ) : (
                      bagTransactions.map(tx => (
                        <div key={tx.id} className="google-card p-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className={cn(
                                  "text-[10px] font-bold px-2 py-0.5 rounded uppercase",
                                  tx.type === 'STOCK_IN' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                )}>
                                  {tx.type?.replace('_', ' ') || 'N/A'}
                                </span>
                                <span className="text-[10px] font-bold bg-slate-100 text-[var(--text-secondary)] px-2 py-0.5 rounded uppercase">
                                  {tx.packagingType?.replace('_', ' ') || 'N/A'}
                                </span>
                                <span className="text-[10px] text-[var(--text-secondary)]">{tx.date ? new Date(tx.date).toLocaleDateString() : 'N/A'}</span>
                              </div>
                              <h3 className="font-bold text-[var(--text-primary)]">{tx.reference}</h3>
                              <p className="text-[10px] text-[var(--text-secondary)]">
                                Warehouse: {warehouses.find(w => w.id === tx.warehouseId)?.name || 'Main'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={cn(
                                "text-lg font-bold",
                                tx.type === 'STOCK_IN' ? "text-emerald-600" : "text-amber-600"
                              )}>
                                {tx.type === 'STOCK_IN' ? '+' : '-'}{tx.quantity}
                              </p>
                              <p className="text-[10px] text-[var(--text-secondary)]">Units</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )
                  )}
                </div>
              </section>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
