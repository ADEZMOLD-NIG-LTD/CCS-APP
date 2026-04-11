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
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, orderBy, where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, reportFirestoreError, formatFirestoreError, OperationType } from '../lib/firestore';
import Toast from './Toast';
import ConfirmModal from './ConfirmModal';
import { cn } from '../lib/utils';

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
  
  // Date Range State
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const [filterType, setFilterType] = useState<'ALL' | 'INFLOW' | 'OUTFLOW'>('ALL');
  const [filterMethod, setFilterMethod] = useState<'ALL' | 'CASH' | 'BANK_TRANSFER'>('ALL');

  // Load Data from Firestore
  useEffect(() => {
    if (!profile?.companyId) return;

    const qJournal = query(
      collection(db, 'journal'), 
      where('companyId', '==', profile.companyId),
      orderBy('date', 'desc')
    );
    const unsubscribeJournal = onSnapshot(qJournal, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as JournalEntry));
      setEntries(data);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'journal')));

    const qSuppliers = query(
      collection(db, 'suppliers'), 
      where('companyId', '==', profile.companyId),
      orderBy('name', 'asc')
    );
    const unsubscribeSuppliers = onSnapshot(qSuppliers, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Supplier));
      setSuppliers(data);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'suppliers')));

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
    
    const newEntry: any = {
      id,
      companyId: profile.companyId,
      warehouseId: warehouseId || profile.assignedWarehouseId || '',
      date: new Date().toISOString(),
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

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteDoc(doc(db, 'journal', deleteConfirmId));
      setSuccessMessage('Journal entry deleted successfully!');
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, OperationType.DELETE, `journal/${deleteConfirmId}`));
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      const entryDate = e.date.split('T')[0];
      const matchesDate = entryDate >= dateRange.start && entryDate <= dateRange.end;
      const matchesType = filterType === 'ALL' || e.type === filterType;
      const matchesMethod = filterMethod === 'ALL' || e.paymentMethod === filterMethod;
      const matchesWarehouse = selectedWarehouseId === 'ALL' || e.warehouseId === selectedWarehouseId;
      return matchesDate && matchesType && matchesMethod && matchesWarehouse;
    });
  }, [entries, dateRange, filterType, filterMethod, selectedWarehouseId]);

  // Opening Balance Calculation (All entries before start date)
  const openingBalances = useMemo(() => {
    const previousEntries = entries.filter(e => e.date.split('T')[0] < dateRange.start);
    
    const cashIn = previousEntries.filter(e => e.type === 'INFLOW' && e.paymentMethod === 'CASH').reduce((sum, e) => sum + e.amount, 0);
    const cashOut = previousEntries.filter(e => e.type === 'OUTFLOW' && e.paymentMethod === 'CASH').reduce((sum, e) => sum + e.amount, 0);
    
    const bankIn = previousEntries.filter(e => e.type === 'INFLOW' && e.paymentMethod === 'BANK_TRANSFER').reduce((sum, e) => sum + e.amount, 0);
    const bankOut = previousEntries.filter(e => e.type === 'OUTFLOW' && e.paymentMethod === 'BANK_TRANSFER').reduce((sum, e) => sum + e.amount, 0);

    return {
      cash: cashIn - cashOut,
      bank: bankIn - bankOut
    };
  }, [entries, dateRange.start]);

  // Period Totals
  const periodTotals = useMemo(() => {
    const cashIn = filteredEntries.filter(e => e.type === 'INFLOW' && e.paymentMethod === 'CASH').reduce((sum, e) => sum + e.amount, 0);
    const cashOut = filteredEntries.filter(e => e.type === 'OUTFLOW' && e.paymentMethod === 'CASH').reduce((sum, e) => sum + e.amount, 0);
    
    const bankIn = filteredEntries.filter(e => e.type === 'INFLOW' && e.paymentMethod === 'BANK_TRANSFER').reduce((sum, e) => sum + e.amount, 0);
    const bankOut = filteredEntries.filter(e => e.type === 'OUTFLOW' && e.paymentMethod === 'BANK_TRANSFER').reduce((sum, e) => sum + e.amount, 0);

    return {
      cashIn, cashOut, bankIn, bankOut
    };
  }, [filteredEntries]);

  const closingBalances = {
    cash: openingBalances.cash + (periodTotals.cashIn - periodTotals.cashOut),
    bank: openingBalances.bank + (periodTotals.bankIn - periodTotals.bankOut)
  };

  const totalInflow = periodTotals.cashIn + periodTotals.bankIn;
  const totalOutflow = periodTotals.cashOut + periodTotals.bankOut;
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
        message="Are you sure you want to delete this journal entry? This action cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirmId(null)}
        confirmText="Delete"
        type="danger"
      />

      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-slate-900">General Journal</h1>
          {isStaff && (
            <button
              onClick={() => setIsAdding(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-sm font-bold active:scale-95 transition-all"
            >
              <Plus size={18} /> Record Entry
            </button>
          )}
        </div>

        <div className="flex gap-2">
          {['ALL', 'INFLOW', 'OUTFLOW'].map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type as any)}
              className={cn(
                "flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all",
                filterType === type 
                  ? "bg-slate-900 text-white shadow-md" 
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              )}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="flex gap-2 mt-2">
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

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 ml-1">From</label>
            <input 
              type="date" 
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 ml-1">To</label>
            <input 
              type="date" 
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {isAdmin && (
          <div className="mt-4">
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
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
        <AnimatePresence mode="wait">
          {isAdding ? (
            <motion.div
              key="journal-form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold">New Journal Entry</h2>
                <button onClick={() => setIsAdding(false)} className="text-slate-400">Cancel</button>
              </div>

              <form onSubmit={handleAddEntry} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Entry Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEntryType('INFLOW')}
                      className={cn(
                        "py-3 rounded-xl text-xs font-bold border transition-all",
                        entryType === 'INFLOW' 
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700 ring-2 ring-emerald-500" 
                          : "bg-slate-50 border-slate-200 text-slate-500"
                      )}
                    >
                      CASH INFLOW
                    </button>
                    <button
                      type="button"
                      onClick={() => setEntryType('OUTFLOW')}
                      className={cn(
                        "py-3 rounded-xl text-xs font-bold border transition-all",
                        entryType === 'OUTFLOW' 
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
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  >
                    <option value="">Select Category</option>
                    {(entryType === 'INFLOW' ? INFLOW_CATEGORIES : OUTFLOW_CATEGORIES).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {entryType === 'INFLOW' && selectedCategory === 'SALES PROCEEDS' && (
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
                      className="w-full px-4 py-2 bg-white border border-indigo-200 rounded-lg outline-none text-sm" 
                      placeholder="Enter Bank Name (e.g. First Bank, GTB, Zenith)"
                    />
                  </motion.div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Warehouse</label>
                  <select 
                    name="warehouseId" 
                    required 
                    defaultValue={profile?.assignedWarehouseId || ''}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  >
                    <option value="" disabled>Select Warehouse</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Amount (₦)</label>
                  <input name="amount" type="number" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-lg" placeholder="0.00" />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Description</label>
                  <input name="description" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="What is this for?" />
                </div>

                {entryType === 'OUTFLOW' && (
                  <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100">
                    <label className="block text-[10px] font-bold text-rose-600 uppercase mb-2 flex items-center gap-2">
                      <Users size={12} /> Charge to Supplier? (Optional)
                    </label>
                    <select name="supplierId" className="w-full px-4 py-2 bg-white border border-rose-200 rounded-lg outline-none text-sm">
                      <option value="">No - General Business Expense</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.location})</option>)}
                    </select>
                    <p className="text-[9px] text-rose-400 mt-2 italic">
                      * If selected, this amount will be deducted from the supplier's ledger balance.
                    </p>
                  </div>
                )}

                {entryType === 'INFLOW' && (
                  <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                    <label className="block text-[10px] font-bold text-emerald-600 uppercase mb-2 flex items-center gap-2">
                      <Users size={12} /> Link to Buyer/Customer? (Optional)
                    </label>
                    <select name="buyerId" className="w-full px-4 py-2 bg-white border border-emerald-200 rounded-lg outline-none text-sm">
                      <option value="">No - General Income</option>
                      {buyers.map(b => <option key={b.id} value={b.id}>{b.name} ({b.location})</option>)}
                    </select>
                    <p className="text-[9px] text-emerald-400 mt-2 italic">
                      * If selected, this amount will be credited to the customer's ledger balance.
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Payment Method</label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center justify-center gap-2 p-3 border border-slate-200 rounded-xl cursor-pointer has-[:checked]:bg-slate-900 has-[:checked]:text-white transition-all">
                      <input type="radio" name="paymentMethod" value="CASH" defaultChecked className="hidden" />
                      <span className="text-xs font-bold">CASH</span>
                    </label>
                    <label className="flex items-center justify-center gap-2 p-3 border border-slate-200 rounded-xl cursor-pointer has-[:checked]:bg-slate-900 has-[:checked]:text-white transition-all">
                      <input type="radio" name="paymentMethod" value="BANK_TRANSFER" className="hidden" />
                      <span className="text-xs font-bold">TRANSFER</span>
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className={cn(
                    "w-full text-white py-4 rounded-xl font-bold shadow-xl active:scale-[0.98] transition-all mt-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2",
                    entryType === 'INFLOW' ? "bg-emerald-600" : "bg-rose-600"
                  )}
                >
                  {submitting ? 'Recording...' : `Record ${entryType === 'INFLOW' ? 'Inflow' : 'Outflow'}`}
                </button>
              </form>
            </motion.div>
          ) : (
            <div className="space-y-6">
              {/* Balances Section */}
              <div className="space-y-4">
                <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden">
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Harmonized Cash Position</p>
                        <h2 className="text-3xl font-black">₦{(closingBalances.cash + closingBalances.bank).toLocaleString()}</h2>
                      </div>
                      <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md">
                        <Wallet className="text-indigo-400" size={24} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/5 rounded-2xl p-4 backdrop-blur-sm border border-white/10">
                        <div className="flex items-center gap-2 mb-1">
                          <DollarSign size={12} className="text-emerald-400" />
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Cash-in-Hand</p>
                        </div>
                        <p className="text-lg font-black">₦{closingBalances.cash.toLocaleString()}</p>
                        <div className="mt-2 pt-2 border-t border-white/5 flex justify-between items-center">
                          <span className="text-[8px] text-slate-500 uppercase">Opening: ₦{openingBalances.cash.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="bg-white/5 rounded-2xl p-4 backdrop-blur-sm border border-white/10">
                        <div className="flex items-center gap-2 mb-1">
                          <Building2 size={12} className="text-blue-400" />
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Bank Balance</p>
                        </div>
                        <p className="text-lg font-black">₦{closingBalances.bank.toLocaleString()}</p>
                        <div className="mt-2 pt-2 border-t border-white/5 flex justify-between items-center">
                          <span className="text-[8px] text-slate-500 uppercase">Opening: ₦{openingBalances.bank.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
                </div>

                {/* Period Performance */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Period Inflow</p>
                    <div className="flex items-center gap-2">
                      <TrendingUp size={14} className="text-emerald-500" />
                      <span className="text-sm font-black text-slate-900">₦{totalInflow.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Period Outflow</p>
                    <div className="flex items-center gap-2">
                      <TrendingDown size={14} className="text-rose-500" />
                      <span className="text-sm font-black text-slate-900">₦{totalOutflow.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Journal List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Transaction History</h2>
                  <span className="text-[10px] font-bold text-slate-400">{filteredEntries.length} Records</span>
                </div>
                
                {filteredEntries.length === 0 ? (
                  <div className="bg-white rounded-2xl p-12 border border-dashed border-slate-300 text-center">
                    <Receipt className="mx-auto text-slate-200 mb-2" size={48} />
                    <p className="text-sm text-slate-400">No entries found</p>
                  </div>
                ) : (
                  filteredEntries.map(entry => (
                    <div key={entry.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm group">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center",
                            entry.type === 'INFLOW' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                          )}>
                            {entry.type === 'INFLOW' ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className={cn(
                                "text-[8px] font-black px-1.5 py-0.5 rounded uppercase",
                                entry.type === 'INFLOW' ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                              )}>
                                {entry.category}
                              </p>
                              {entry.bankName && (
                                <span className="text-[8px] font-black px-1.5 py-0.5 rounded uppercase bg-indigo-100 text-indigo-700">
                                  {entry.bankName}
                                </span>
                              )}
                              <span className="text-[10px] text-slate-400 font-medium">{entry.paymentMethod}</span>
                            </div>
                            <h3 className="font-bold text-slate-900 mt-0.5">{entry.description}</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Calendar size={10} className="text-slate-300" />
                              <p className="text-[10px] text-slate-400">{new Date(entry.date).toLocaleDateString()}</p>
                              <span className="text-[10px] text-slate-300">•</span>
                              <p className="text-[10px] font-bold text-indigo-400 uppercase">
                                {warehouses.find(w => w.id === entry.warehouseId)?.name || 'Unknown Store'}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cn(
                            "text-lg font-black",
                            entry.type === 'INFLOW' ? "text-emerald-600" : "text-rose-600"
                          )}>
                            {entry.type === 'INFLOW' ? '+' : '-'}₦{(entry.amount || 0).toLocaleString()}
                          </p>
                          <button 
                            onClick={() => deleteEntry(entry.id)}
                            className="text-slate-300 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      {entry.supplierId && (
                        <div className="mt-3 pt-3 border-t border-slate-50 flex items-center gap-2">
                          <AlertCircle size={12} className="text-rose-500" />
                          <p className="text-[10px] font-bold text-rose-600 uppercase">
                            Charged to: {suppliers.find(s => s.id === entry.supplierId)?.name}
                          </p>
                        </div>
                      )}
                      {entry.buyerId && (
                        <div className="mt-3 pt-3 border-t border-slate-50 flex items-center gap-2">
                          <AlertCircle size={12} className="text-emerald-500" />
                          <p className="text-[10px] font-bold text-emerald-600 uppercase">
                            Received from: {buyers.find(b => b.id === entry.buyerId)?.name}
                          </p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
