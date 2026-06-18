/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, ArrowRightLeft, History, Warehouse as WarehouseIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CommodityType, PackagingType, Transaction, BagTransaction, Supplier, Warehouse, InventoryAdjustment, AdjustmentTypeValue } from '../types';
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
import AdjustmentForm from './inventory/AdjustmentForm';
import AdjustmentLedger from './inventory/AdjustmentLedger';
import ConfirmModal from './ConfirmModal';

const COMMODITIES: CommodityType[] = ['COCOA', 'CASHEW', 'PK'];
const PACKAGING: PackagingType[] = ['JUTE_BAG', 'NYLON_BAG'];
const BENCHMARKS = { COCOA: 8, CASHEW: 10, PK: 8 };

export default function InventoryModule() {
  const { profile, isStaff, isAdmin, canTransferStock, canPostTransactions, isOnline } = useAuth();
  const [activeTab, setActiveTab] = useState<'COMMODITIES' | 'PACKAGING' | 'ADJUSTMENTS'>('COMMODITIES');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bagTransactions, setBagTransactions] = useState<BagTransaction[]>([]);
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingAdjustment, setIsAddingAdjustment] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [isTransferringBag, setIsTransferringBag] = useState(false);
  const [isAddingBag, setIsAddingBag] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingAdjustment, setEditingAdjustment] = useState<InventoryAdjustment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('ALL');
  const [isWalkIn, setIsWalkIn] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmAdjustmentId, setDeleteConfirmAdjustmentId] = useState<string | null>(null);

  // Default selected warehouse for staff
  React.useEffect(() => {
    if (profile?.assignedWarehouseId && !isAdmin) {
      setSelectedWarehouseId(profile.assignedWarehouseId);
    }
  }, [profile, isAdmin]);

  // Success message auto-hide
  React.useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);
  
  // Form State - Moved to sub-components or handled via direct data

  // Load Data from Firestore
  React.useEffect(() => {
    if (!profile?.companyId) return;

    const qTx = query(
      collection(db, 'transactions'), 
      where('companyId', '==', profile.companyId),
      where('type', '==', 'PURCHASE')
    );
    const unsubscribeTx = onSnapshot(qTx, (snapshot) => {
      const data = snapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id } as Transaction))
        .filter(tx => !tx.isDeleted);
      const sorted = data.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      setTransactions(sorted);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'transactions')));

    const qSuppliers = query(
      collection(db, 'suppliers'), 
      where('companyId', '==', profile.companyId)
    );
    const unsubscribeSuppliers = onSnapshot(qSuppliers, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Supplier));
      const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
      setSuppliers(sorted);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'suppliers')));

    const qWarehouses = query(
      collection(db, 'warehouses'), 
      where('companyId', '==', profile.companyId)
    );
    const unsubscribeWarehouses = onSnapshot(qWarehouses, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Warehouse));
      const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
      setWarehouses(sorted);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'warehouses')));

    const qBags = query(
      collection(db, 'bag_transactions'), 
      where('companyId', '==', profile.companyId)
    );
    const unsubscribeBags = onSnapshot(qBags, (snapshot) => {
      const data = snapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id } as BagTransaction))
        .filter(tx => !tx.isDeleted);
      const sorted = data.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      setBagTransactions(sorted);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'bag_transactions')));

    const qAdjustments = query(
      collection(db, 'inventory_adjustments'), 
      where('companyId', '==', profile.companyId)
    );
    const unsubscribeAdjustments = onSnapshot(qAdjustments, (snapshot) => {
      const data = snapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id } as InventoryAdjustment))
        .filter(adj => !adj.isDeleted);
      const sorted = data.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      setAdjustments(sorted);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'inventory_adjustments')));

    return () => {
      unsubscribeTx();
      unsubscribeSuppliers();
      unsubscribeWarehouses();
      unsubscribeBags();
      unsubscribeAdjustments();
    };
  }, [profile?.companyId]);

  // Calculation Logic - Moved to sub-components

  // Inventory Summary (Calculated from all transactions)
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  React.useEffect(() => {
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

  const inventory = React.useMemo(() => {
    const summary: Record<string, number> = { COCOA: 0, CASHEW: 0, PK: 0 };
    allTransactions.forEach(tx => {
      const weightKg = getWeightInKg(tx.netWeight);
      if (summary[tx.commodity] === undefined) {
        summary[tx.commodity] = 0;
      }
      if (selectedWarehouseId !== 'ALL') {
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
        // Transfers don't change total inventory, only location
      }
    });

    // Factor in Inventory Adjustments
    adjustments.forEach(adj => {
      if (adj.isDeleted) return;
      if (selectedWarehouseId !== 'ALL' && adj.warehouseId !== selectedWarehouseId) return;
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

  const packagingInventory = React.useMemo(() => {
    const summary: Record<PackagingType, number> = { JUTE_BAG: 0, NYLON_BAG: 0 };
    bagTransactions.forEach(tx => {
      if (tx.type === 'TRANSFER') {
        if (selectedWarehouseId === 'ALL') return;
        if (tx.sourceWarehouseId === selectedWarehouseId) summary[tx.packagingType] -= Number(tx.quantity) || 0;
        if (tx.destinationWarehouseId === selectedWarehouseId) summary[tx.packagingType] += Number(tx.quantity) || 0;
      } else {
        if (selectedWarehouseId !== 'ALL' && tx.warehouseId !== selectedWarehouseId) return;
        if (tx.type === 'STOCK_IN' || tx.type === 'RETURN') summary[tx.packagingType] += Number(tx.quantity) || 0;
        if (tx.type === 'ISSUE') summary[tx.packagingType] -= Number(tx.quantity) || 0;
      }
    });
    return summary;
  }, [bagTransactions, selectedWarehouseId]);

  const getWarehouseStock = (warehouseId: string, commodityType: CommodityType) => {
    const transTotal = allTransactions.reduce((sum, tx) => {
      if (tx.commodity !== commodityType) return sum;
      const weightKg = getWeightInKg(tx.netWeight);
      if (tx.type === 'PURCHASE' && tx.warehouseId === warehouseId) return sum + weightKg;
      if (tx.type === 'SALE' && tx.warehouseId === warehouseId) {
        // Direct delivery bypasses physical warehouse inventory
        if (!tx.isDirectDelivery) {
          return sum - weightKg;
        }
      }
      if (tx.type === 'TRANSFER') {
        if (tx.sourceWarehouseId === warehouseId) return sum - weightKg;
        if (tx.destinationWarehouseId === warehouseId) return sum + weightKg;
      }
      return sum;
    }, 0);

    const adjTotal = adjustments.reduce((sum, adj) => {
      if (adj.isDeleted || adj.commodity !== commodityType || adj.warehouseId !== warehouseId) return sum;
      return adj.adjustmentDirection === 'ADD' ? sum + adj.netWeight : sum - adj.netWeight;
    }, 0);

    return transTotal + adjTotal;
  };

  const getWarehouseBagStock = (warehouseId: string, pkgType: PackagingType) => {
    return bagTransactions.reduce((sum, tx) => {
      if (tx.packagingType !== pkgType) return sum;
      if (tx.type === 'TRANSFER') {
        if (tx.sourceWarehouseId === warehouseId) return sum - (Number(tx.quantity) || 0);
        if (tx.destinationWarehouseId === warehouseId) return sum + (Number(tx.quantity) || 0);
      } else {
        if (tx.warehouseId !== warehouseId) return sum;
        if (tx.type === 'STOCK_IN' || tx.type === 'RETURN') return sum + (Number(tx.quantity) || 0);
        if (tx.type === 'ISSUE') return sum - (Number(tx.quantity) || 0);
      }
      return sum;
    }, 0);
  };

  const handleAddEntryDirect = async (data: any) => {
    if (!canPostTransactions || submitting || !profile?.companyId) return;

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

    const transactionDateIso = data.date 
      ? new Date(data.date + 'T12:00:00').toISOString() 
      : (editingTransaction?.date || new Date().toISOString());

    const newTx: any = {
      id: editingTransaction?.id || id,
      companyId: profile.companyId,
      date: transactionDateIso,
      postingDate: editingTransaction?.postingDate || new Date().toISOString(),
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

  const handleAdjustmentSubmit = async (data: any) => {
    if (!profile?.companyId) return;
    setSubmitting(true);
    const id = editingAdjustment ? editingAdjustment.id : crypto.randomUUID();
    
    const adjustmentPayload: InventoryAdjustment = {
      id,
      companyId: profile.companyId,
      date: new Date(data.date).toISOString(),
      postingDate: editingAdjustment ? editingAdjustment.postingDate : new Date().toISOString(),
      commodity: data.commodity,
      warehouseId: data.warehouseId,
      adjustmentType: data.adjustmentType,
      adjustmentDirection: data.adjustmentDirection,
      netWeight: Number(data.netWeight),
      bags: Number(data.bags),
      notes: data.notes,
      createdBy: profile.uid,
      creatorEmail: profile.email
    };

    if (editingAdjustment) {
      if (editingAdjustment.isDeleted !== undefined) adjustmentPayload.isDeleted = editingAdjustment.isDeleted;
      if (editingAdjustment.deletedBy !== undefined) adjustmentPayload.deletedBy = editingAdjustment.deletedBy;
      if (editingAdjustment.deletedAt !== undefined) adjustmentPayload.deletedAt = editingAdjustment.deletedAt;
      if (editingAdjustment.deletionReason !== undefined) adjustmentPayload.deletionReason = editingAdjustment.deletionReason;
    }

    try {
      const writePromise = setDoc(doc(db, 'inventory_adjustments', id), adjustmentPayload);
      if (isOnline) await writePromise;

      recordAuditLog({
        companyId: profile.companyId,
        userId: profile.uid,
        userEmail: profile.email,
        action: editingAdjustment ? AuditAction.UPDATE : AuditAction.CREATE,
        module: 'Inventory (Adjustment)',
        recordId: id,
        details: `${editingAdjustment ? 'Updated' : 'Created'} adjustment of ${data.netWeight}kg of ${data.commodity} (${data.adjustmentType}) in ${warehouses.find(w => w.id === data.warehouseId)?.name}`,
        newData: adjustmentPayload,
        previousData: editingAdjustment || undefined
      }).catch(err => console.error('Audit log failed:', err));

      setIsAddingAdjustment(false);
      setEditingAdjustment(null);
      setSuccessMessage(editingAdjustment ? 'Adjustment updated successfully!' : 'Adjustment posted successfully!');
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, editingAdjustment ? OperationType.UPDATE : OperationType.CREATE, `inventory_adjustments/${id}`));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditAdjustmentClick = (adj: InventoryAdjustment) => {
    setEditingAdjustment(adj);
    setIsAddingAdjustment(true);
  };

  const handleDeleteAdjustmentClick = (id: string) => {
    setDeleteConfirmAdjustmentId(id);
  };

  const confirmDeleteAdjustment = async (reason: string) => {
    if (!deleteConfirmAdjustmentId || !profile?.companyId) return;
    setSubmitting(true);
    const id = deleteConfirmAdjustmentId;
    const existing = adjustments.find(a => a.id === id);
    if (!existing) {
      setDeleteConfirmAdjustmentId(null);
      setSubmitting(false);
      return;
    }

    try {
      const updateData = {
        isDeleted: true,
        deletedBy: profile.email,
        deletionReason: reason,
        deletedAt: new Date().toISOString()
      };
      
      const writePromise = updateDoc(doc(db, 'inventory_adjustments', id), updateData);
      if (isOnline) await writePromise;

      recordAuditLog({
        companyId: profile.companyId,
        userId: profile.uid,
        userEmail: profile.email,
        action: AuditAction.DELETE,
        module: 'Inventory (Adjustment)',
        recordId: id,
        details: `Deleted adjustment: ${existing.netWeight}kg ${existing.commodity} (${existing.adjustmentType}). Reason: ${reason}`,
        newData: updateData
      }).catch(err => console.error('Audit log failed:', err));

      setDeleteConfirmAdjustmentId(null);
      setSuccessMessage('Adjustment record deleted successfully.');
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, OperationType.DELETE, `inventory_adjustments/${id}`));
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

      <ConfirmModal
        isOpen={!!deleteConfirmAdjustmentId}
        title="Delete Inventory Adjustment"
        message="Are you sure you want to delete this inventory adjustment? Current commodity stock levels will be updated accordingly."
        onConfirm={confirmDeleteAdjustment}
        onCancel={() => setDeleteConfirmAdjustmentId(null)}
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
            ) : activeTab === 'PACKAGING' ? (
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
            ) : (
              <div className="flex items-center gap-2">
                {canPostTransactions && !isAddingAdjustment && !editingAdjustment && (
                  <button
                    onClick={() => {
                      setEditingAdjustment(null);
                      setIsAddingAdjustment(true);
                    }}
                    className="google-btn-primary flex items-center gap-2 shrink-0"
                  >
                    <Plus size={18} /> <span>New Adjustment</span>
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
            onClick={() => {
              setActiveTab('COMMODITIES');
              setIsAddingAdjustment(false);
              setEditingAdjustment(null);
            }}
            className={cn(
              "flex-1 py-2 rounded-lg text-xs font-bold transition-all",
              activeTab === 'COMMODITIES' ? "bg-white text-[var(--accent)] shadow-sm" : "text-[var(--text-secondary)]"
            )}
          >
            Commodities
          </button>
          <button
            onClick={() => {
              setActiveTab('PACKAGING');
              setIsAddingAdjustment(false);
              setEditingAdjustment(null);
            }}
            className={cn(
              "flex-1 py-2 rounded-lg text-xs font-bold transition-all",
              activeTab === 'PACKAGING' ? "bg-white text-[var(--accent)] shadow-sm" : "text-[var(--text-secondary)]"
            )}
          >
            Packaging (Bags)
          </button>
          <button
            onClick={() => {
              setActiveTab('ADJUSTMENTS');
              setIsAddingAdjustment(false);
              setEditingAdjustment(null);
            }}
            className={cn(
              "flex-1 py-2 rounded-lg text-xs font-bold transition-all",
              activeTab === 'ADJUSTMENTS' ? "bg-white text-[var(--accent)] shadow-sm" : "text-[var(--text-secondary)]"
            )}
          >
            Stock Adjustments
          </button>
        </div>

        <AnimatePresence mode="wait">
          {isAddingAdjustment || editingAdjustment ? (
            <AdjustmentForm
              key="adjustment-form"
              warehouses={warehouses}
              getWarehouseStock={getWarehouseStock}
              profile={profile}
              editingAdjustment={editingAdjustment}
              submitting={submitting}
              onCancel={() => {
                setIsAddingAdjustment(false);
                setEditingAdjustment(null);
              }}
              onSubmit={handleAdjustmentSubmit}
            />
          ) : isAdding || editingTransaction ? (
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
              getWarehouseBagStock={getWarehouseBagStock}
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
                activeTab={activeTab === 'ADJUSTMENTS' ? 'COMMODITIES' : activeTab}
                inventory={inventory}
                packagingInventory={packagingInventory}
              />

              {activeTab === 'ADJUSTMENTS' ? (
                <AdjustmentLedger
                  adjustments={adjustments}
                  warehouses={warehouses}
                  isAdmin={isAdmin}
                  onEdit={handleEditAdjustmentClick}
                  onDelete={handleDeleteAdjustmentClick}
                />
              ) : (
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
              )}
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
