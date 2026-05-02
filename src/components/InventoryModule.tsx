/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, ArrowRightLeft, History, Warehouse as WarehouseIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CommodityType, PackagingType, Transaction, BagTransaction, Supplier, Warehouse } from '../types';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, query, orderBy, where, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { reportFirestoreError, OperationType } from '../lib/firestore';
import { recordAuditLog, AuditAction } from '../lib/audit';
import Toast from './Toast';
import { cn, roundTo, formatNumber, formatCurrency, getWeightInKg } from '../lib/utils';

// Sub-components
import PurchaseForm from './inventory/PurchaseForm';
import BagTransactionForm from './inventory/BagTransactionForm';
import BagTransferForm from './inventory/BagTransferForm';
import StockTransferForm from './inventory/StockTransferForm';
import InventoryStats from './inventory/InventoryStats';
import TransactionList from './inventory/TransactionList';
import ConfirmModal from './ConfirmModal';

const COMMODITIES: CommodityType[] = ['COCOA', 'CASHEW', 'PK'];
const PACKAGING: PackagingType[] = ['JUTE_BAG', 'NYLON_BAG'];
const BENCHMARKS = { COCOA: 8, CASHEW: 10, PK: 8 };

export default function InventoryModule() {
  const { profile, isStaff, isAdmin, canTransferStock, canPostTransactions, isOnline } = useAuth();
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
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('ALL');
  const [isWalkIn, setIsWalkIn] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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
  
  // Form State - Moved to sub-components or handled via direct data

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
      const data = snapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id } as BagTransaction))
        .filter(tx => !tx.isDeleted);
      setBagTransactions(data);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'bag_transactions')));

    return () => {
      unsubscribeTx();
      unsubscribeSuppliers();
      unsubscribeWarehouses();
      unsubscribeBags();
    };
  }, [profile?.companyId]);

  // Calculation Logic - Moved to sub-components

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
      const weightKg = getWeightInKg(tx.netWeight);
      if (selectedWarehouseId !== 'ALL') {
        if (tx.type === 'PURCHASE' && tx.warehouseId === selectedWarehouseId) summary[tx.commodity] += weightKg;
        if (tx.type === 'SALE' && tx.warehouseId === selectedWarehouseId) summary[tx.commodity] -= weightKg;
        if (tx.type === 'TRANSFER') {
          if (tx.sourceWarehouseId === selectedWarehouseId) summary[tx.commodity] -= weightKg;
          if (tx.destinationWarehouseId === selectedWarehouseId) summary[tx.commodity] += weightKg;
        }
      } else {
        if (tx.type === 'PURCHASE') summary[tx.commodity] += weightKg;
        if (tx.type === 'SALE') summary[tx.commodity] -= weightKg;
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
      const weightKg = getWeightInKg(tx.netWeight);
      if (tx.type === 'PURCHASE' && tx.warehouseId === warehouseId) return sum + weightKg;
      if (tx.type === 'SALE' && tx.warehouseId === warehouseId) return sum - weightKg;
      if (tx.type === 'TRANSFER') {
        if (tx.sourceWarehouseId === warehouseId) return sum - weightKg;
        if (tx.destinationWarehouseId === warehouseId) return sum + weightKg;
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

  const handleAddEntryDirect = async (data: any) => {
    if (submitting || !profile?.companyId) return;

    setSubmitting(true);
    const id = crypto.randomUUID();
    const walkInId = `WALK_IN_${profile.companyId}`;
    
    if (data.isWalkIn) {
      const exists = suppliers.find(s => s.id === walkInId);
      if (!exists) {
        const walkInSupplier: Supplier = {
          id: walkInId,
          companyId: profile.companyId,
          name: 'Walk-in Supplier (General)',
          phone: 'N/A',
          location: 'N/A',
          bankName: '',
          accountNumber: '',
          accountName: '',
          previousBalance: 0,
          createdAt: new Date().toISOString()
        };
        try {
          await setDoc(doc(db, 'suppliers', walkInId), walkInSupplier);
        } catch (err) {
          console.error('Failed to create walk-in supplier:', err);
        }
      }
    }

    const supplierId = data.isWalkIn ? walkInId : data.supplierId;

    const newTx: any = {
      id: editingTransaction?.id || id,
      companyId: profile.companyId,
      date: editingTransaction?.date || new Date().toISOString(),
      type: 'PURCHASE',
      commodity: data.commodity,
      calculationMethod: data.calculationMethod,
      supplierId,
      storeRecordId: data.storeRecordId,
      grossWeight: data.grossWeight,
      netWeight: data.netWeight,
      bags: data.bags,
      noOfBags: data.bags,
      pricePerKg: data.price,
      totalValue: data.totalValue || roundTo(data.netWeight * data.price, 2),
      referenceId: editingTransaction?.referenceId || `TX-${Date.now().toString().slice(-6)}`,
      warehouseId: data.warehouseId || profile?.assignedWarehouseId || '',
      deductions: data.deductions
    };

    Object.keys(newTx).forEach(key => newTx[key] === undefined && delete newTx[key]);

    try {
      const writePromise = setDoc(doc(db, 'transactions', newTx.id), newTx);
      if (isOnline) await writePromise;
      
      recordAuditLog({
        companyId: profile.companyId,
        userId: profile.uid,
        userEmail: profile.email,
        action: editingTransaction ? AuditAction.UPDATE : AuditAction.CREATE,
        module: 'Inventory (Purchase)',
        recordId: newTx.id,
        details: `${editingTransaction ? 'Updated' : 'Created'} purchase transaction for ${newTx.commodity} (${newTx.netWeight}kg)`,
        newData: newTx,
        previousData: editingTransaction || undefined
      }).catch(err => console.error('Audit log failed:', err));

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

  const handleAddBagEntryDirect = async (data: any) => {
    if (!isStaff || submitting || !profile?.companyId) return;

    setSubmitting(true);
    const id = crypto.randomUUID();
    
    const newTx: any = {
      id,
      companyId: profile.companyId,
      date: new Date().toISOString(),
      type: data.type,
      packagingType: data.packagingType,
      quantity: data.quantity,
      reference: data.reference || `BAG-${Date.now().toString().slice(-6)}`,
      warehouseId: data.warehouseId || profile?.assignedWarehouseId || '',
      supplierId: data.supplierId
    };

    Object.keys(newTx).forEach(key => newTx[key] === undefined && delete newTx[key]);

    if (data.type === 'ISSUE') {
      if (!newTx.supplierId) {
        setErrorMessage('Supplier is required for bag issuance.');
        setSubmitting(false);
        return;
      }
      const currentStock = getWarehouseBagStock(newTx.warehouseId, data.packagingType);
      if (data.quantity > currentStock) {
        setErrorMessage(`Insufficient ${data.packagingType.replace('_', ' ')} stock. Available: ${formatNumber(currentStock, 0)} units`);
        setSubmitting(false);
        return;
      }
    }

    try {
      const writePromise = setDoc(doc(db, 'bag_transactions', id), newTx);
      if (isOnline) await writePromise;
      
      recordAuditLog({
        companyId: profile.companyId,
        userId: profile.uid,
        userEmail: profile.email,
        action: AuditAction.CREATE,
        module: 'Inventory (Bags)',
        recordId: id,
        details: `Recorded ${data.type.replace('_', ' ')}: ${newTx.quantity} ${newTx.packagingType.replace('_', ' ')}`,
        newData: newTx
      }).catch(err => console.error('Audit log failed:', err));

      setIsAddingBag(false);
      setSuccessMessage(`${data.packagingType.replace('_', ' ')} ${data.type === 'STOCK_IN' ? 'Stock-in' : 'Issuance'} recorded!`);
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, OperationType.CREATE, `bag_transactions/${id}`));
    } finally {
      setSubmitting(false);
    }
  };

  const handleBagTransferDirect = async (data: any) => {
    if (!isStaff || submitting || !profile?.companyId) return;

    if (data.sourceWarehouseId === data.destinationWarehouseId) {
      setErrorMessage('Source and destination warehouses must be different.');
      return;
    }

    const sourceStock = getWarehouseBagStock(data.sourceWarehouseId, data.packagingType);
    if (data.quantity > sourceStock) {
      setErrorMessage(`Insufficient stock in source warehouse. Available: ${formatNumber(sourceStock || 0, 0)} units`);
      return;
    }

    setSubmitting(true);
    const id = crypto.randomUUID();
    const transferTx: any = {
      id,
      companyId: profile.companyId,
      date: new Date().toISOString(),
      type: 'TRANSFER',
      packagingType: data.packagingType,
      sourceWarehouseId: data.sourceWarehouseId,
      destinationWarehouseId: data.destinationWarehouseId,
      quantity: data.quantity,
      reference: data.reference || `BTR-${Date.now().toString().slice(-6)}`,
    };

    Object.keys(transferTx).forEach(key => transferTx[key] === undefined && delete transferTx[key]);

    try {
      const writePromise = setDoc(doc(db, 'bag_transactions', id), transferTx);
      if (isOnline) await writePromise;
      
      recordAuditLog({
        companyId: profile.companyId,
        userId: profile.uid,
        userEmail: profile.email,
        action: AuditAction.CREATE,
        module: 'Inventory (Bag Transfer)',
        recordId: id,
        details: `Transferred ${data.quantity} ${data.packagingType.replace('_', ' ')} from ${warehouses.find(w => w.id === data.sourceWarehouseId)?.name} to ${warehouses.find(w => w.id === data.destinationWarehouseId)?.name}`,
        newData: transferTx
      }).catch(err => console.error('Audit log failed:', err));

      setIsTransferringBag(false);
      setSuccessMessage(`${data.packagingType.replace('_', ' ')} transfer recorded!`);
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, OperationType.CREATE, `bag_transactions/${id}`));
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransferDirect = async (data: any) => {
    if (!isStaff || submitting || !profile?.companyId) return;

    if (data.sourceWarehouseId === data.destinationWarehouseId) {
      setErrorMessage('Source and destination warehouses must be different.');
      return;
    }

    const sourceStock = getWarehouseStock(data.sourceWarehouseId, data.commodity);
    if (data.weight > sourceStock) {
      setErrorMessage(`Insufficient stock in source warehouse. Available: ${formatNumber(sourceStock)}kg`);
      return;
    }

    setSubmitting(true);
    const id = crypto.randomUUID();
    const transferTx: any = {
      id,
      companyId: profile.companyId,
      date: new Date().toISOString(),
      type: 'TRANSFER',
      commodity: data.commodity,
      sourceWarehouseId: data.sourceWarehouseId,
      destinationWarehouseId: data.destinationWarehouseId,
      grossWeight: data.weight,
      netWeight: data.weight,
      bags: data.bags,
      noOfBags: data.bags,
      referenceId: `TR-${Date.now().toString().slice(-6)}`,
      deductions: {
        moistureActual: 0,
        moistureBenchmark: 0,
        tareWeight: 0,
        moldWeight: 0,
        otherDeduction: 0
      }
    };

    Object.keys(transferTx).forEach(key => transferTx[key] === undefined && delete transferTx[key]);

    try {
      const writePromise = setDoc(doc(db, 'transactions', id), transferTx);
      if (isOnline) await writePromise;
      
      recordAuditLog({
        companyId: profile.companyId,
        userId: profile.uid,
        userEmail: profile.email,
        action: AuditAction.CREATE,
        module: 'Inventory (Transfer)',
        recordId: id,
        details: `Transferred ${data.weight}kg of ${data.commodity} from ${warehouses.find(w => w.id === data.sourceWarehouseId)?.name} to ${warehouses.find(w => w.id === data.destinationWarehouseId)?.name}`,
        newData: transferTx
      }).catch(err => console.error('Audit log failed:', err));

      setIsTransferring(false);
      setSuccessMessage('Stock transfer completed successfully!');
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, OperationType.CREATE, `transactions/${id}`));
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setEditingTransaction(null);
    setIsWalkIn(false);
  };

  const handleEditClick = (tx: Transaction) => {
    setEditingTransaction(tx);
    setIsWalkIn(tx.supplierId?.startsWith('WALK_IN_') || false);
    setIsAdding(true);
  };

  const handleDeleteEntry = async (txId: string) => {
    if (!isAdmin) return;
    setDeleteConfirmId(txId);
  };

  const confirmDeletePurchase = async (reason?: string) => {
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
        module: 'Inventory (Purchase)',
        recordId: deleteConfirmId,
        details: `Deleted (Soft) purchase transaction. Reason: ${reason}`,
        newData: updateData
      }).catch(err => console.error('Audit log failed:', err));

      setSuccessMessage('Purchase record removed.');
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, OperationType.UPDATE, `transactions/${deleteConfirmId}`));
    } finally {
      setDeleteConfirmId(null);
    }
  };


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

      <ConfirmModal
        isOpen={!!deleteConfirmId}
        title="Delete Purchase Record"
        message="Are you sure you want to delete this purchase record? It will be hidden from reports but remain in the logs."
        onConfirm={confirmDeletePurchase}
        onCancel={() => setDeleteConfirmId(null)}
        confirmText="Delete"
        type="danger"
        requireReason={true}
      />

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
            <PurchaseForm
              key="purchase-form"
              suppliers={suppliers}
              warehouses={warehouses}
              profile={profile}
              editingTransaction={editingTransaction}
              submitting={submitting}
              onCancel={() => { setIsAdding(false); setEditingTransaction(null); }}
              onSubmit={async (data) => {
                await handleAddEntryDirect(data);
              }}
            />
          ) : isTransferringBag ? (
            <BagTransferForm
              key="bag-transfer-form"
              warehouses={warehouses}
              getWarehouseBagStock={getWarehouseBagStock}
              submitting={submitting}
              onCancel={() => setIsTransferringBag(false)}
              onSubmit={handleBagTransferDirect}
            />
          ) : isAddingBag ? (
            <BagTransactionForm
              key="bag-form"
              suppliers={suppliers}
              warehouses={warehouses}
              profile={profile}
              submitting={submitting}
              onCancel={() => setIsAddingBag(false)}
              onSubmit={handleAddBagEntryDirect}
            />
          ) : isTransferring ? (
            <StockTransferForm
              key="transfer-form"
              warehouses={warehouses}
              getWarehouseStock={getWarehouseStock}
              submitting={submitting}
              onCancel={() => setIsTransferring(false)}
              onSubmit={handleTransferDirect}
            />
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

              <InventoryStats
                activeTab={activeTab}
                inventory={inventory}
                packagingInventory={packagingInventory}
              />

              <TransactionList
                activeTab={activeTab}
                transactions={transactions}
                bagTransactions={bagTransactions}
                suppliers={suppliers}
                warehouses={warehouses}
                isAdmin={isAdmin}
                onEdit={handleEditClick}
                onDelete={handleDeleteEntry}
              />
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
