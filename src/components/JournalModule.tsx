/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Receipt, 
  ArrowLeft, 
  Wallet, 
  Users, 
  Calendar, 
  Trash2, 
  Filter,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Building2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { JournalEntry, Supplier, Buyer, Warehouse } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, query, orderBy, where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, reportFirestoreError, formatFirestoreError, OperationType } from '../lib/firestore';
import { recordAuditLog, AuditAction } from '../lib/audit';
import Toast from './Toast';
import ConfirmModal from './ConfirmModal';
import { cn } from '../lib/utils';
import JournalForm from './journal/JournalForm';
import JournalList from './journal/JournalList';
import JournalSummary from './journal/JournalSummary';

const INFLOW_CATEGORIES = [
  'CAPITAL',
  'LOAN',
  'SALES PROCEEDS',
  'INVESTMENT',
  'OTHER INCOME'
];

const OUTFLOW_CATEGORIES = [
  'TRANSPORT',
  'LOADING/UNLOADING',
  'WAREHOUSE RENT',
  'STAFF SALARY',
  'UTILITIES',
  'MAINTENANCE',
  'SUPPLIER CHARGEBACK',
  'OFFICE SUPPLIES',
  'OTHER EXPENSE'
];

export default function JournalModule() {
  const { profile, isStaff, isAccount, isAdmin, canPostTransactions } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [entryType, setEntryType] = useState<'INFLOW' | 'OUTFLOW'>('OUTFLOW');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('ALL');

  const [filterMethod, setFilterMethod] = useState<'ALL' | 'CASH' | 'BANK_TRANSFER'>('ALL');

  // Load Data from Firestore
  useEffect(() => {
    if (!profile?.companyId) return;

    const qJournal = query(
      collection(db, 'journal'), 
      where('companyId', '==', profile.companyId)
    );
    const unsubscribeJournal = onSnapshot(qJournal, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as JournalEntry));
      const sorted = data.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      setEntries(sorted);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'journal')));

    const qSuppliers = query(
      collection(db, 'suppliers'), 
      where('companyId', '==', profile.companyId)
    );
    const unsubscribeSuppliers = onSnapshot(qSuppliers, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Supplier));
      const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
      setSuppliers(sorted);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'suppliers')));

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
      setWarehouses(data);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'warehouses')));

    return () => {
      unsubscribeJournal();
      unsubscribeSuppliers();
      unsubscribeBuyers();
      unsubscribeWarehouses();
    };
  }, [profile?.companyId]);

  // Default selected warehouse for staff
  useEffect(() => {
    if (profile?.assignedWarehouseId && !isAdmin) {
      setSelectedWarehouseId(profile.assignedWarehouseId);
    }
  }, [profile, isAdmin]);

  const handleAddEntry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canPostTransactions || submitting || !profile?.companyId) return;

    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const id = crypto.randomUUID();
    
    const supplierId = formData.get('supplierId') as string;
    const buyerId = formData.get('buyerId') as string;
    const warehouseId = formData.get('warehouseId') as string;
    const selectedDate = formData.get('transactionDate') as string;
    const transactionDateIso = selectedDate 
      ? new Date(selectedDate + 'T12:00:00').toISOString() 
      : new Date().toISOString();
    
    const newEntry: any = {
      id,
      companyId: profile.companyId,
      warehouseId: warehouseId || profile.assignedWarehouseId || '',
      date: transactionDateIso,
      postingDate: new Date().toISOString(),
      type: entryType,
      category: formData.get('category') as string,
      amount: Number(formData.get('amount')),
      description: formData.get('description') as string,
      paymentMethod: formData.get('paymentMethod') as any,
      bankName: formData.get('bankName') as string || undefined,
    };

    if (supplierId) {
      newEntry.supplierId = supplierId;
    }

    if (buyerId) {
      newEntry.buyerId = buyerId;
    }

    // Clean up undefined values
    Object.keys(newEntry).forEach(key => newEntry[key] === undefined && delete newEntry[key]);

    try {
      await setDoc(doc(db, 'journal', id), newEntry);
      setIsAdding(false);
      setSuccessMessage(`${entryType === 'INFLOW' ? 'Inflow' : 'Outflow'} successfully recorded!`);
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, OperationType.CREATE, `journal/${id}`));
    } finally {
      setSubmitting(false);
    }
  };

  const deleteEntry = async (id: string) => {
    if (!isAdmin) {
      setErrorMessage('Only Admins can delete journal entries.');
      return;
    }
    setDeleteConfirmId(id);
  };

  const confirmDelete = async (reason?: string) => {
    if (!deleteConfirmId || !profile) return;
    try {
      const updateData = {
        isDeleted: true,
        deletionReason: reason || 'No reason provided',
        deletedBy: profile.email,
        deletedAt: new Date().toISOString()
      };
      await updateDoc(doc(db, 'journal', deleteConfirmId), updateData);
      
      recordAuditLog({
        companyId: profile.companyId,
        userId: profile.uid,
        userEmail: profile.email,
        action: AuditAction.DELETE,
        module: 'Journal',
        recordId: deleteConfirmId,
        details: `Deleted (Soft) journal entry. Reason: ${reason}`,
        newData: updateData
      }).catch(err => console.error('Audit log failed:', err));

      setSuccessMessage('Journal entry deleted successfully!');
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, OperationType.UPDATE, `journal/${deleteConfirmId}`));
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (e.isDeleted) return false;
      if ((e as any).excludeFromJournal) return false;
      const matchesMethod = filterMethod === 'ALL' || e.paymentMethod === filterMethod;
      const matchesWarehouse = selectedWarehouseId === 'ALL' || e.warehouseId === selectedWarehouseId;
      return matchesMethod && matchesWarehouse;
    });
  }, [entries, filterMethod, selectedWarehouseId]);

  // Financial Positions (Lifetime, filtered only by warehouse if applicable)
  const financialPositions = useMemo(() => {
    // Only filter by warehouse if selected and not 'ALL'
    const warehouseEntries = entries.filter(e => 
      !e.isDeleted && !((e as any).excludeFromJournal) && (selectedWarehouseId === 'ALL' || e.warehouseId === selectedWarehouseId)
    );

    const cashIn = warehouseEntries.filter(e => e.type === 'INFLOW' && e.paymentMethod === 'CASH').reduce((sum, e) => sum + e.amount, 0);
    const cashOut = warehouseEntries.filter(e => e.type === 'OUTFLOW' && e.paymentMethod === 'CASH').reduce((sum, e) => sum + e.amount, 0);
    
    const bankIn = warehouseEntries.filter(e => e.type === 'INFLOW' && e.paymentMethod === 'BANK_TRANSFER').reduce((sum, e) => sum + e.amount, 0);
    const bankOut = warehouseEntries.filter(e => e.type === 'OUTFLOW' && e.paymentMethod === 'BANK_TRANSFER').reduce((sum, e) => sum + e.amount, 0);

    return {
      cash: cashIn - cashOut,
      bank: bankIn - bankOut,
      totalInflow: cashIn + bankIn,
      totalOutflow: cashOut + bankOut
    };
  }, [entries, selectedWarehouseId]);

  const closingBalances = {
    cash: financialPositions.cash,
    bank: financialPositions.bank
  };

  const totalInflow = financialPositions.totalInflow;
  const totalOutflow = financialPositions.totalOutflow;
  const netCash = totalInflow - totalOutflow;

  return (
    <div className="flex flex-col h-full bg-slate-50">
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
        title="Delete Journal Entry"
        message="Are you sure you want to delete this journal entry? It will be hidden from accounting records but preserved in audit logs."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirmId(null)}
        confirmText="Delete"
        type="danger"
        requireReason={true}
      />

      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-bold text-slate-900">
            {isAdding ? 'New Journal Entry' : 'General Journal'}
          </h1>
          {isStaff && !isAdding && (
            <button
              onClick={() => setIsAdding(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-sm font-bold active:scale-95 transition-all"
            >
              <Plus size={18} /> Record Entry
            </button>
          )}
          {isAdding && (
            <button
              onClick={() => setIsAdding(false)}
              className="text-sm font-bold text-slate-500 hover:text-slate-700 flex items-center gap-1 active:scale-95 transition-all"
            >
              <ArrowLeft size={16} /> Back to List
            </button>
          )}
        </div>

        {!isAdding && (
          <div className="space-y-3 mt-2">
            <div className="flex gap-2">
              {['ALL', 'CASH', 'BANK_TRANSFER'].map(method => (
                <button
                  key={method}
                  onClick={() => setFilterMethod(method as any)}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border",
                    filterMethod === method 
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-sm" 
                      : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                  )}
                >
                  {method === 'BANK_TRANSFER' ? 'BANK' : method}
                </button>
              ))}
            </div>

            {isAdmin && (
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Warehouse Filter (Harmonize)</label>
                <select 
                  value={selectedWarehouseId}
                  onChange={(e) => setSelectedWarehouseId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none"
                >
                  <option value="ALL">ALL WAREHOUSES (HARMONIZED)</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
        <AnimatePresence mode="wait">
          {isAdding ? (
            <motion.div
              key="journal-form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <JournalForm
                profile={profile}
                entryType={entryType}
                setEntryType={setEntryType}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                inflowCategories={INFLOW_CATEGORIES}
                outflowCategories={OUTFLOW_CATEGORIES}
                warehouses={warehouses}
                suppliers={suppliers}
                buyers={buyers}
                submitting={submitting}
                onSubmit={handleAddEntry}
                onCancel={() => setIsAdding(false)}
              />
            </motion.div>
          ) : (
            <div className="space-y-6">
              <JournalSummary
                closingBalances={closingBalances}
                totalInflow={totalInflow}
                totalOutflow={totalOutflow}
              />

              <JournalList
                filteredEntries={filteredEntries}
                suppliers={suppliers}
                buyers={buyers}
                warehouses={warehouses}
                isAdmin={isAdmin}
                onDeleteEntry={deleteEntry}
              />
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
