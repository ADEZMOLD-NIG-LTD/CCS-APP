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
  ChevronRight,
  Edit2
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
import { DigitFormattedInput } from './DigitFormattedInput';

const INFLOW_CATEGORIES = [
  'CAPITAL',
  'LOAN',
  'SALES PROCEEDS',
  'INVESTMENT',
  'ADVANCE RECEIPT',
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
  'DRAWINGS',
  'ADVANCE PAYMENT',
  'ASSET PURCHASE',
  'REPAIRS AND SERVICES',
  'DIESEL AND PETROL',
  'OUTSTANDING PAYMENT',
  'OUTSTANDING/ADVANCE',
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
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [editEntryType, setEditEntryType] = useState<'INFLOW' | 'OUTFLOW'>('OUTFLOW');
  const [editSelectedCategory, setEditSelectedCategory] = useState<string>('');

  useEffect(() => {
    if (editingEntry) {
      setEditEntryType(editingEntry.type);
      setEditSelectedCategory(editingEntry.category);
    }
  }, [editingEntry]);

  // Load Data from Firestore
  useEffect(() => {
    if (!profile?.companyId) return;

    const qJournal = query(
      collection(db, 'journal'), 
      where('companyId', '==', profile.companyId)
    );
    const unsubscribeJournal = onSnapshot(qJournal, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as JournalEntry));
      const sorted = data.sort((a, b) => {
        const dateA = new Date(a.date || 0).getTime();
        const dateB = new Date(b.date || 0).getTime();
        if (dateA !== dateB) return dateA - dateB;
        const postA = new Date(a.postingDate || a.date || 0).getTime();
        const postB = new Date(b.postingDate || b.date || 0).getTime();
        return postA - postB;
      });
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
    if (profile?.assignedWarehouseId && !isAccount) {
      setSelectedWarehouseId(profile.assignedWarehouseId);
    }
  }, [profile, isAccount]);

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
    if (!isAccount) {
      setErrorMessage('Only authorized managers or accountants can delete journal entries.');
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

  const handleAdjustSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isAccount || !editingEntry || submitting || !profile?.companyId) return;

    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const updatedDate = formData.get('transactionDate') as string;
    const dateIso = updatedDate ? new Date(updatedDate + 'T12:00:00').toISOString() : editingEntry.date;

    const supplierId = formData.get('supplierId') as string || undefined;
    const buyerId = formData.get('buyerId') as string || undefined;
    const warehouseId = formData.get('warehouseId') as string;
    const amountVal = Number(formData.get('amount') || 0);
    const categoryVal = formData.get('category') as string;
    const descVal = formData.get('description') as string;
    const paymentMethodVal = formData.get('paymentMethod') as any;
    const bankNameVal = formData.get('bankName') as string || undefined;

    try {
      const docRef = doc(db, 'journal', editingEntry.id);
      
      const updatedEntry: any = {
        ...editingEntry,
        type: editEntryType,
        date: dateIso,
        warehouseId,
        amount: amountVal,
        category: categoryVal,
        description: descVal,
        paymentMethod: paymentMethodVal,
      };

      if (editEntryType === 'INFLOW' && categoryVal === 'SALES PROCEEDS' && bankNameVal) {
        updatedEntry.bankName = bankNameVal;
      } else {
        if ('bankName' in updatedEntry) {
          delete updatedEntry.bankName;
        }
      }

      if (editEntryType === 'OUTFLOW' && supplierId) {
        updatedEntry.supplierId = supplierId;
      } else if (editEntryType === 'INFLOW' && supplierId) {
        // refund/reversal
        updatedEntry.supplierId = supplierId;
      } else {
        if ('supplierId' in updatedEntry) {
          delete updatedEntry.supplierId;
        }
      }

      if (editEntryType === 'INFLOW' && buyerId) {
        updatedEntry.buyerId = buyerId;
      } else {
        if ('buyerId' in updatedEntry) {
          delete updatedEntry.buyerId;
        }
      }

      // Clean up undefined values
      Object.keys(updatedEntry).forEach(key => updatedEntry[key] === undefined && delete updatedEntry[key]);

      await setDoc(docRef, updatedEntry);

      // Record Audit Log
      await recordAuditLog({
        companyId: profile.companyId,
        userId: profile.uid,
        userEmail: profile.email,
        action: AuditAction.UPDATE,
        module: 'Journal',
        recordId: editingEntry.id,
        details: `Adjusted journal entry ${editingEntry.id}: set amount to ₦${amountVal}, category to ${categoryVal}, description to ${descVal}`,
        previousData: editingEntry,
        newData: updatedEntry
      }).catch(err => console.error('Failed to log audit:', err));

      setEditingEntry(null);
      setSuccessMessage('Journal entry successfully adjusted!');
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, OperationType.UPDATE, `journal/${editingEntry.id}`));
    } finally {
      setSubmitting(false);
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

            {isAccount && (
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
                isAdmin={isAccount}
                onDeleteEntry={deleteEntry}
              />
            </div>
          )}

          {editingEntry && (
            <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-4 overflow-y-auto">
              <motion.div 
                initial={{ y: "100%" }} 
                animate={{ y: 0 }} 
                exit={{ y: "100%" }}
                className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl my-auto text-slate-800"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold flex items-center gap-2 text-indigo-600">
                    <Edit2 size={24} /> Adjust Journal Entry
                  </h2>
                  <button type="button" onClick={() => setEditingEntry(null)} className="text-slate-400 hover:text-slate-600">
                    Cancel
                  </button>
                </div>

                <form onSubmit={handleAdjustSave} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Entry Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditEntryType('INFLOW');
                          setEditSelectedCategory('');
                        }}
                        className={cn(
                          "py-3 rounded-xl text-xs font-bold border transition-all",
                          editEntryType === 'INFLOW' 
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700 ring-2 ring-emerald-500" 
                            : "bg-slate-50 border-slate-200 text-slate-500"
                        )}
                      >
                        CASH INFLOW
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditEntryType('OUTFLOW');
                          setEditSelectedCategory('');
                        }}
                        className={cn(
                          "py-3 rounded-xl text-xs font-bold border transition-all",
                          editEntryType === 'OUTFLOW' 
                            ? "bg-rose-50 border-rose-200 text-rose-700 ring-2 ring-rose-500" 
                            : "bg-slate-50 border-slate-200 text-slate-500"
                        )}
                      >
                        CASH OUTFLOW
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Category</label>
                    <select 
                      name="category" 
                      required 
                      value={editSelectedCategory}
                      onChange={(e) => setEditSelectedCategory(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium text-slate-700"
                    >
                      <option value="">Select Category</option>
                      {(editEntryType === 'INFLOW' ? INFLOW_CATEGORIES : OUTFLOW_CATEGORIES).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {editEntryType === 'INFLOW' && editSelectedCategory === 'SALES PROCEEDS' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100"
                    >
                      <label className="block text-[10px] font-bold text-indigo-600 uppercase mb-2 flex items-center gap-2">
                        <Building2 size={12} /> Bank Name
                      </label>
                      <input 
                        name="bankName" 
                        defaultValue={editingEntry.bankName || ''}
                        className="w-full px-4 py-2 bg-white border border-indigo-200 rounded-lg outline-none text-sm font-medium text-slate-700" 
                        placeholder="Enter Bank Name (e.g. First Bank, GTB, Zenith)"
                      />
                    </motion.div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Warehouse</label>
                      <select 
                        name="warehouseId" 
                        required 
                        defaultValue={editingEntry.warehouseId || ''}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium text-slate-700"
                      >
                        <option value="" disabled>Select Warehouse</option>
                        {warehouses.map(w => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Transaction Date</label>
                      <input
                        name="transactionDate"
                        type="date"
                        required
                        defaultValue={editingEntry.date?.substring(0, 10)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Amount (₦)</label>
                    <DigitFormattedInput 
                      name="amount" 
                      required 
                      defaultValue={editingEntry.amount}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-lg" 
                      placeholder="0.00" 
                      prefix="₦"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Description</label>
                    <input 
                      name="description" 
                      required 
                      defaultValue={editingEntry.description}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium" 
                      placeholder="What is this for?" 
                    />
                  </div>

                  {editEntryType === 'OUTFLOW' && (
                    <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100">
                      <label className="block text-[10px] font-bold text-rose-600 uppercase mb-2 flex items-center gap-2">
                        <Users size={12} /> Charge to Supplier? (Optional)
                      </label>
                      <select 
                        name="supplierId" 
                        defaultValue={editingEntry.supplierId || ''}
                        className="w-full px-4 py-2 bg-white border border-rose-200 rounded-lg outline-none text-sm font-medium text-slate-700"
                      >
                        <option value="">No - General Business Expense</option>
                        {suppliers
                          .filter(s => !s.isDeleted || s.id === editingEntry.supplierId)
                          .map(s => <option key={s.id} value={s.id}>{s.name} ({s.location})</option>)}
                      </select>
                      <p className="text-[9px] text-rose-400 mt-2 italic">
                        * If selected, this amount will be deducted from the supplier's ledger balance.
                      </p>
                    </div>
                  )}

                  {editEntryType === 'INFLOW' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                        <label className="block text-[10px] font-bold text-emerald-600 uppercase mb-2 flex items-center gap-2">
                          <Users size={12} /> Link to Buyer/Customer? (Optional)
                        </label>
                        <select 
                          name="buyerId" 
                          defaultValue={editingEntry.buyerId || ''}
                          className="w-full px-4 py-2 bg-white border border-emerald-200 rounded-lg outline-none text-sm font-medium text-slate-700"
                        >
                          <option value="">No - General Income</option>
                          {buyers
                            .filter(b => !b.isDeleted || b.id === editingEntry.buyerId)
                            .map(b => <option key={b.id} value={b.id}>{b.name} ({b.location})</option>)}
                        </select>
                        <p className="text-[9px] text-emerald-400 mt-2 italic">
                          * If selected, this amount will be credited to the customer's ledger balance.
                        </p>
                      </div>

                      <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                        <label className="block text-[10px] font-bold text-emerald-600 uppercase mb-2 flex items-center gap-2">
                          <Users size={12} /> Reversal/Refund from Supplier? (Optional)
                        </label>
                        <select 
                          name="supplierId" 
                          defaultValue={editingEntry.supplierId || ''}
                          className="w-full px-4 py-2 bg-white border border-emerald-200 rounded-lg outline-none text-sm font-medium text-slate-700"
                        >
                          <option value="">No - General Income</option>
                          {suppliers
                            .filter(s => !s.isDeleted || s.id === editingEntry.supplierId)
                            .map(s => <option key={s.id} value={s.id}>{s.name} ({s.location})</option>)}
                        </select>
                        <p className="text-[9px] text-emerald-400 mt-2 italic">
                          * If selected, this amount will be credited back/refunded to the supplier's ledger balance.
                        </p>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Payment Method</label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className={cn(
                        "flex items-center justify-center gap-2 p-3 border border-slate-200 rounded-xl cursor-pointer transition-all",
                        "has-[:checked]:bg-slate-900 has-[:checked]:text-white"
                      )}>
                        <input type="radio" name="paymentMethod" value="CASH" defaultChecked={editingEntry.paymentMethod === 'CASH'} className="hidden" />
                        <span className="text-xs font-bold">CASH</span>
                      </label>
                      <label className={cn(
                        "flex items-center justify-center gap-2 p-3 border border-slate-200 rounded-xl cursor-pointer transition-all",
                        "has-[:checked]:bg-slate-900 has-[:checked]:text-white"
                      )}>
                        <input type="radio" name="paymentMethod" value="BANK_TRANSFER" defaultChecked={editingEntry.paymentMethod === 'BANK_TRANSFER'} className="hidden" />
                        <span className="text-xs font-bold">TRANSFER</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button type="button" onClick={() => setEditingEntry(null)} className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-all">Cancel</button>
                    <button 
                      type="submit" 
                      disabled={submitting}
                      className={cn(
                        "flex-2 text-white py-4 rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm font-medium",
                        editEntryType === 'INFLOW' ? "bg-emerald-600" : "bg-rose-600"
                      )}
                    >
                      {submitting ? 'Saving Changes...' : 'Save Adjustments'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
