/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  setDoc,
  doc, 
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { PettyCashTransaction, Warehouse, JournalEntry } from '../types';
import { reportFirestoreError, OperationType } from '../lib/firestore';
import { DigitFormattedInput } from './DigitFormattedInput';
import { motion } from 'motion/react';
import { 
  Wallet, 
  PlusCircle, 
  CheckCircle, 
  Calendar, 
  Building2, 
  User, 
  Tag, 
  Trash2, 
  Check, 
  X,
  FileText, 
  AlertCircle 
} from 'lucide-react';

const CATEGORIES = [
  'Office Supplies',
  'Fuel & Transportation',
  'Loading & Labor',
  'Minor Repairs',
  'Meals & Entertainment',
  'Utility & Security',
  'Cleaning',
  'Other Minor Expense'
];

export default function PettyCashModule() {
  const { profile, isAdmin, isManager, isAccount } = useAuth();
  const [transactions, setTransactions] = useState<PettyCashTransaction[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  
  // UI states
  const [isAdding, setIsAdding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Filter states
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<'ALL' | 'DISBURSEMENT' | 'EXPENSE'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'PENDING' | 'RETIRED'>('ALL');
  
  // Selection for Retirement
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([]);
  const [showRetirementModal, setShowRetirementModal] = useState(false);
  const [retiring, setRetiring] = useState(false);

  // Form states
  const [txType, setTxType] = useState<'DISBURSEMENT' | 'EXPENSE'>('EXPENSE');
  const [linkJournalForDisbursement, setLinkJournalForDisbursement] = useState(true);

  // Check roles
  const canFundOrRetire = isAdmin || isManager || isAccount;

  // Load Data
  useEffect(() => {
    if (!profile?.companyId) return;

    // Load Petty Cash Transactions
    const qTx = query(
      collection(db, 'petty_cash'),
      where('companyId', '==', profile.companyId)
    );
    const unsubscribeTx = onSnapshot(qTx, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as PettyCashTransaction));
      // Sort: latest date first, fallback to postingDate
      const sorted = data.sort((a, b) => {
        const dateA = new Date(a.date || 0).getTime();
        const dateB = new Date(b.date || 0).getTime();
        if (dateB !== dateA) return dateB - dateA;
        const postA = new Date(a.postingDate || a.date || 0).getTime();
        const postB = new Date(b.postingDate || b.date || 0).getTime();
        return postB - postA;
      });
      setTransactions(sorted);
    }, (error) => {
      setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'petty_cash'));
    });

    // Load Warehouses
    const qWh = query(
      collection(db, 'warehouses'),
      where('companyId', '==', profile.companyId)
    );
    const unsubscribeWh = onSnapshot(qWh, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Warehouse));
      setWarehouses(data);
    }, (error) => {
      setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'warehouses'));
    });

    return () => {
      unsubscribeTx();
      unsubscribeWh();
    };
  }, [profile?.companyId]);

  // Handle Default Warehouse Selection for non-admins
  useEffect(() => {
    if (profile?.assignedWarehouseId && !isAdmin && !isManager && !isAccount) {
      setSelectedWarehouseId(profile.assignedWarehouseId);
    }
  }, [profile, isAdmin, isManager, isAccount]);

  // Calculate Metrics
  const filteredTxs = transactions.filter(tx => {
    if (tx.isDeleted) return false;
    if (selectedWarehouseId !== 'ALL' && tx.warehouseId !== selectedWarehouseId) return false;
    if (selectedType !== 'ALL' && tx.type !== selectedType) return false;
    if (selectedStatus !== 'ALL' && tx.status !== selectedStatus) return false;
    return true;
  });

  const aggregateMetrics = () => {
    let disburseTotal = 0;
    let expenseTotal = 0;
    let pendingRetireTotal = 0;

    transactions.forEach(tx => {
      if (tx.isDeleted) return;
      // Filter by warehouse if applicable
      if (selectedWarehouseId !== 'ALL' && tx.warehouseId !== selectedWarehouseId) return;

      if (tx.type === 'DISBURSEMENT') {
        disburseTotal += tx.amount;
      } else {
        expenseTotal += tx.amount;
        if (tx.status === 'PENDING') {
          pendingRetireTotal += tx.amount;
        }
      }
    });

    return {
      disbursed: disburseTotal,
      spent: expenseTotal,
      balance: disburseTotal - expenseTotal,
      pendingRetirement: pendingRetireTotal
    };
  };

  const metrics = aggregateMetrics();

  // Handle Add Transaction
  const handleAddTransaction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting || !profile?.companyId) return;

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const formData = new FormData(e.currentTarget);
    const amountVal = Number(formData.get('amount'));
    const description = formData.get('description') as string;
    const category = formData.get('category') as string;
    const dateInput = formData.get('date') as string;
    const warehouseId = formData.get('warehouseId') as string;
    const recipient = formData.get('recipient') as string;
    const reference = formData.get('reference') as string;

    if (!amountVal || amountVal <= 0) {
      setErrorMessage('Amount must be greater than zero.');
      setSubmitting(false);
      return;
    }

    if (!warehouseId) {
      setErrorMessage('Please select a store/warehouse.');
      setSubmitting(false);
      return;
    }

    if (txType === 'EXPENSE') {
      let warehouseDisburse = 0;
      let warehouseExpense = 0;
      transactions.forEach(tx => {
        if (tx.isDeleted || tx.warehouseId !== warehouseId) return;
        if (tx.type === 'DISBURSEMENT') {
          warehouseDisburse += tx.amount;
        } else {
          warehouseExpense += tx.amount;
        }
      });
      const warehouseBalance = warehouseDisburse - warehouseExpense;
      if (amountVal > warehouseBalance) {
        const whObj = warehouses.find(w => w.id === warehouseId);
        const whName = whObj ? whObj.name : 'selected store';
        setErrorMessage(`Insufficient funds in the petty cash book of "${whName}". Available: ₦${warehouseBalance.toLocaleString()}. Requested: ₦${amountVal.toLocaleString()}.`);
        setSubmitting(false);
        return;
      }
    }

    const isoDate = dateInput
      ? new Date(dateInput + 'T12:00:00').toISOString()
      : new Date().toISOString();

    const txId = crypto.randomUUID();
    const newTx: PettyCashTransaction = {
      id: txId,
      companyId: profile.companyId,
      warehouseId,
      date: isoDate,
      postingDate: new Date().toISOString(),
      type: txType,
      amount: amountVal,
      category: txType === 'DISBURSEMENT' ? 'Replenish Petty Cash' : category,
      description,
      recipient: txType === 'DISBURSEMENT' ? 'Petty Cash Box' : recipient || 'Staff',
      status: txType === 'DISBURSEMENT' ? 'RETIRED' : 'PENDING',
      createdBy: profile.uid,
      creatorEmail: profile.email,
    };

    if (reference) {
      newTx.reference = reference;
    }

    try {
      if (txType === 'DISBURSEMENT' && linkJournalForDisbursement) {
        // Also create an OUTFLOW General Journal entry
        const journalId = crypto.randomUUID();
        const journalEntry: JournalEntry = {
          id: journalId,
          companyId: profile.companyId,
          warehouseId,
          date: isoDate,
          postingDate: new Date().toISOString(),
          type: 'OUTFLOW',
          category: 'PETTY CASH',
          amount: amountVal,
          description: `[Replenish Petty Cash Box] ${description}`,
          paymentMethod: 'CASH',
        };

        newTx.retiredJournalId = journalId;
        newTx.status = 'RETIRED';
        newTx.retiredDate = new Date().toISOString();

        // Write both
        await setDoc(doc(db, 'journal', journalId), journalEntry);
      }

      await setDoc(doc(db, 'petty_cash', txId), newTx);
      
      setSuccessMessage(`${txType === 'DISBURSEMENT' ? 'Funding Disbursement' : 'Petty cash expense'} saved successfully!`);
      setIsAdding(false);
    } catch (error: any) {
      setErrorMessage(reportFirestoreError(error, OperationType.CREATE, 'petty_cash'));
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Multi-Selection toggles
  const toggleSelectExpense = (id: string) => {
    setSelectedExpenseIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllPending = () => {
    const pendingIds = filteredTxs
      .filter(tx => tx.type === 'EXPENSE' && tx.status === 'PENDING')
      .map(tx => tx.id);
    
    if (selectedExpenseIds.length === pendingIds.length) {
      setSelectedExpenseIds([]);
    } else {
      setSelectedExpenseIds(pendingIds);
    }
  };

  // Bulk Retire & Link to General Journal
  const handleBulkRetirement = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (retiring || selectedExpenseIds.length === 0 || !profile?.companyId) return;

    setRetiring(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const formData = new FormData(e.currentTarget);
    const retiredDateInput = formData.get('retiredDate') as string;
    const retiredWarehouseId = formData.get('retiredWarehouseId') as string;
    const paymentMethod = formData.get('paymentMethod') as 'CASH' | 'BANK_TRANSFER';
    const bankName = formData.get('bankName') as string;

    const retiredIsoDate = retiredDateInput
      ? new Date(retiredDateInput + 'T12:00:00').toISOString()
      : new Date().toISOString();

    const selectedTxs = transactions.filter(tx => selectedExpenseIds.includes(tx.id));
    const totalAmount = selectedTxs.reduce((sum, tx) => sum + tx.amount, 0);

    const journalId = crypto.randomUUID();
    const journalEntry: JournalEntry = {
      id: journalId,
      companyId: profile.companyId,
      warehouseId: retiredWarehouseId || profile.assignedWarehouseId || 'ALL',
      date: retiredIsoDate,
      postingDate: new Date().toISOString(),
      type: 'OUTFLOW',
      category: 'PETTY CASH RETIREMENT',
      amount: totalAmount,
      description: `[Petty Cash Retirement] Consolidating ${selectedTxs.length} expense transactions. Details: ${selectedTxs.map(t => `${t.category}(₦${t.amount.toLocaleString()})`).join(', ')}`,
      paymentMethod,
      ...(bankName ? { bankName } : {})
    };

    try {
      const batch = writeBatch(db);

      // Create the General Journal outflow entry
      const journalRef = doc(db, 'journal', journalId);
      batch.set(journalRef, journalEntry);

      // Update all selected petty cash transaction statuses to RETIRED, and reference the journal ID
      selectedTxs.forEach(tx => {
        const txRef = doc(db, 'petty_cash', tx.id);
        batch.update(txRef, {
          status: 'RETIRED',
          retiredDate: retiredIsoDate,
          retiredJournalId: journalId
        });
      });

      await batch.commit();

      setSuccessMessage(`Retired ${selectedTxs.length} petty cash expenses totaling ₦${totalAmount.toLocaleString()} and successfully poster to General Journal.`);
      setSelectedExpenseIds([]);
      setShowRetirementModal(false);
    } catch (error: any) {
      setErrorMessage(reportFirestoreError(error, OperationType.UPDATE, 'petty_cash'));
    } finally {
      setRetiring(false);
    }
  };

  // Soft Delete individual transaction
  const handleDeleteTx = async (tx: PettyCashTransaction) => {
    if (!window.confirm('Are you sure you want to delete this petty cash record? This cannot be undone.')) return;
    
    setErrorMessage(null);
    setSuccessMessage(null);

    const updatedTx = {
      ...tx,
      isDeleted: true,
      deletedBy: profile?.email || profile?.uid || 'Unknown',
      deletedAt: new Date().toISOString(),
      deletionReason: 'User deleted petty cash entry'
    };

    try {
      await setDoc(doc(db, 'petty_cash', tx.id), updatedTx);
      setSuccessMessage('Petty Cash transaction deleted successfully.');
    } catch (error: any) {
      setErrorMessage(reportFirestoreError(error, OperationType.DELETE, 'petty_cash'));
    }
  };

  return (
    <div id="petty-cash-module-root" className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 text-slate-800">
      
      {/* Header and Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Wallet className="text-slate-600" size={32} />
            Petty Cash Ledger
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Track minor operational cash-in-hand expenses, replenishment disbursements, and audit trails.
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {selectedExpenseIds.length > 0 && canFundOrRetire && (
            <button
              onClick={() => setShowRetirementModal(true)}
              className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg hover:bg-emerald-700 transition"
            >
              Retire Selected ({selectedExpenseIds.length})
            </button>
          )}

          <button
            onClick={() => {
              setTxType('EXPENSE');
              setIsAdding(true);
            }}
            className="px-4 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-bold shadow-md hover:bg-slate-900 transition flex items-center gap-2"
          >
            <PlusCircle size={18} />
            Add Minor Expense
          </button>

          {canFundOrRetire && (
            <button
              onClick={() => {
                setTxType('DISBURSEMENT');
                setIsAdding(true);
              }}
              className="px-4 py-2.5 border border-slate-300 bg-white text-slate-700 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 transition"
            >
              Record Disbursement
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      {errorMessage && (
        <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-xl flex items-start gap-3">
          <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={18} />
          <p className="text-sm font-bold text-rose-800">{errorMessage}</p>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-xl flex items-start gap-3">
          <CheckCircle className="text-emerald-500 shrink-0 mt-0.5" size={18} />
          <p className="text-sm font-bold text-emerald-800">{successMessage}</p>
        </div>
      )}

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 tracking-wider block uppercase">Replenished Funding</span>
            <span className="text-2xl font-black text-slate-900 mt-1 block">
              ₦{metrics.disbursed.toLocaleString()}
            </span>
          </div>
          <div className="w-12 h-12 bg-sky-50 text-sky-600 rounded-xl flex items-center justify-center">
            <PlusCircle size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 tracking-wider block uppercase">Expenses Spent</span>
            <span className="text-2xl font-black text-slate-900 mt-1 block">
              ₦{metrics.spent.toLocaleString()}
            </span>
          </div>
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
            <Trash2 size={22} />
          </div>
        </div>

        <div className={`bg-gradient-to-br p-5 rounded-2xl border flex items-center justify-between ${
          metrics.balance < 10000 
            ? 'from-rose-50 to-rose-100 border-rose-200 shadow-sm text-rose-950' 
            : 'from-slate-50 to-slate-100 border-slate-200 shadow-sm text-slate-950'
        }`}>
          <div>
            <span className="text-xs font-bold text-slate-400 tracking-wider block uppercase">Current Petty Cash Bal</span>
            <span className="text-2xl font-black mt-1 block">
              ₦{metrics.balance.toLocaleString()}
            </span>
            {metrics.balance < 10000 && (
              <span className="text-[10px] font-bold text-rose-600 mt-0.5 block flex items-center gap-1">
                ⚠️ Low Petty Cash Balance! Please Disburse / Replenish
              </span>
            )}
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${metrics.balance < 10000 ? 'bg-rose-100 text-rose-700' : 'bg-white text-slate-800 shadow-sm'}`}>
            <Wallet size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 tracking-wider block uppercase">Pending Retirement</span>
            <span className="text-2xl font-black text-slate-900 mt-1 block">
              ₦{metrics.pendingRetirement.toLocaleString()}
            </span>
          </div>
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
            <CheckCircle size={22} />
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Store / Warehouse</label>
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              disabled={profile?.assignedWarehouseId !== undefined && !isAdmin && !isManager && !isAccount}
              className="text-xs font-semibold px-3 py-1.5 border border-slate-200 bg-slate-50/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              <option value="ALL">All Stores</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as any)}
              className="text-xs font-semibold px-3 py-1.5 border border-slate-200 bg-slate-50/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              <option value="ALL">All Transactions</option>
              <option value="EXPENSE">Expense Outlays</option>
              <option value="DISBURSEMENT">Funding Replenishments</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Retirement Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="text-xs font-semibold px-3 py-1.5 border border-slate-200 bg-slate-50/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              <option value="ALL">All Status</option>
              <option value="PENDING">Pending (Not in main Journal)</option>
              <option value="RETIRED">Retired (Linked to Journal)</option>
            </select>
          </div>
        </div>

        <div className="text-xs font-medium text-slate-400">
          Showing <span className="font-bold text-slate-600">{filteredTxs.length}</span> transaction(s)
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase">
                {selectedType === 'ALL' || selectedType === 'EXPENSE' ? (
                  <th className="py-4 px-4 text-center w-12">
                    <input
                      type="checkbox"
                      checked={
                        filteredTxs.filter(tx => tx.type === 'EXPENSE' && tx.status === 'PENDING').length > 0 &&
                        selectedExpenseIds.length === filteredTxs.filter(tx => tx.type === 'EXPENSE' && tx.status === 'PENDING').length
                      }
                      onChange={handleSelectAllPending}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                ) : null}
                <th className="py-4 px-4">Date</th>
                <th className="py-4 px-4">Store</th>
                <th className="py-4 px-4">Type</th>
                <th className="py-4 px-4">Category</th>
                <th className="py-4 px-4 text-right">Amount</th>
                <th className="py-4 px-4">Recipient</th>
                <th className="py-4 px-4">Description / Ref</th>
                <th className="py-4 px-4">Status & Journal Link</th>
                <th className="py-4 px-4 text-center w-16">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {filteredTxs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-slate-400 font-medium whitespace-nowrap">
                    No petty cash transactions found for the current selection.
                  </td>
                </tr>
              ) : (
                filteredTxs.map(tx => {
                  const wh = warehouses.find(w => w.id === tx.warehouseId);
                  const isExpPending = tx.type === 'EXPENSE' && tx.status === 'PENDING';
                  const isSelected = selectedExpenseIds.includes(tx.id);

                  return (
                    <tr 
                      key={tx.id} 
                      className={`hover:bg-slate-50/50 transition-colors ${
                        isSelected ? 'bg-indigo-50/20' : ''
                      }`}
                    >
                      {selectedType === 'ALL' || selectedType === 'EXPENSE' ? (
                        <td className="py-3 px-4 text-center">
                          {isExpPending ? (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectExpense(tx.id)}
                              className="rounded text-indigo-600 focus:ring-indigo-500"
                            />
                          ) : (
                            <span className="text-slate-200">-</span>
                          )}
                        </td>
                      ) : null}
                      
                      <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-600">
                        {new Date(tx.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap font-bold text-slate-700">
                        {wh?.name || 'Central Box'}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider ${
                          tx.type === 'DISBURSEMENT' 
                            ? 'bg-sky-50 text-sky-700' 
                            : 'bg-indigo-50 text-indigo-700'
                        }`}>
                          {tx.type}
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap font-semibold text-slate-600">
                        {tx.category}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-right font-black text-slate-900">
                        ₦{tx.amount.toLocaleString()}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-medium">
                        {tx.recipient}
                      </td>

                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                        <div className="font-medium text-slate-700">{tx.description}</div>
                        {tx.reference && <div className="text-[10px] text-slate-400 font-mono mt-0.5">Ref: {tx.reference}</div>}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {tx.type === 'DISBURSEMENT' ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600">
                              <CheckCircle size={12} />
                              Funded
                            </span>
                            {tx.retiredJournalId && (
                              <span className="text-[9px] text-slate-400 font-mono">
                                Journal ID: {tx.retiredJournalId.substring(0, 8)}...
                              </span>
                            )}
                          </div>
                        ) : tx.status === 'RETIRED' ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                              <CheckCircle size={12} />
                              Retired
                            </span>
                            {tx.retiredJournalId && (
                              <span className="text-[9px] text-slate-400 font-mono">
                                Journal ID: {tx.retiredJournalId.substring(0, 8)}...
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                            Pending Journal Link
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleDeleteTx(tx)}
                          className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition"
                          title="Delete petty cash record"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Transaction Overlay Modal */}
      {isAdding && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden border border-slate-100"
          >
            <div className="bg-slate-800 text-white px-6 py-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black tracking-tight">
                  {txType === 'DISBURSEMENT' ? 'Record Petty Cash Funding' : 'Record Minor Spent Cash'}
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Ensure detail records align with physical receipt slips if available.
                </p>
              </div>
              <button 
                onClick={() => setIsAdding(false)}
                className="text-slate-400 hover:text-white p-1 rounded-xl transition"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddTransaction} className="p-6 space-y-4">
              
              {/* Type Switcher for Managers/Accountants */}
              {canFundOrRetire && (
                <div id="tx-type-selector" className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setTxType('EXPENSE')}
                    className={`py-2 text-xs font-bold rounded-lg transition-all ${
                      txType === 'EXPENSE'
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Recorded Expense (Spent)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxType('DISBURSEMENT')}
                    className={`py-2 text-xs font-bold rounded-lg transition-all ${
                      txType === 'DISBURSEMENT'
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Account Funding (Disbursement)
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                    Transaction Date *
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3.5 text-slate-400" size={16} />
                    <input
                      name="date"
                      type="date"
                      required
                      defaultValue={new Date().toISOString().substring(0, 10)}
                      className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                    Store / warehouse *
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-3.5 text-slate-400" size={16} />
                    <select
                      name="warehouseId"
                      required
                      defaultValue={profile?.assignedWarehouseId || ''}
                      disabled={profile?.assignedWarehouseId !== undefined && !isAdmin && !isManager && !isAccount}
                      className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-400 appearance-none"
                    >
                      <option value="">Select Warehouse</option>
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                    Amount (₦) *
                  </label>
                  <DigitFormattedInput
                    name="amount"
                    required
                    placeholder="0"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-400"
                    prefix="₦"
                  />
                </div>

                {txType === 'EXPENSE' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                      Category *
                    </label>
                    <div className="relative">
                      <Tag className="absolute left-3 top-3.5 text-slate-400" size={16} />
                      <select
                        name="category"
                        required
                        className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-400 appearance-none"
                      >
                        <option value="">Select Category</option>
                        {CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                      Vessel / Provider
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-3.5 text-slate-400" size={16} />
                      <input
                        name="recipient"
                        type="text"
                        placeholder="Petty Cash Box"
                        disabled
                        className="w-full pl-9 pr-3 py-3 bg-slate-100 border border-slate-200 text-slate-500 rounded-xl text-sm font-medium focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {txType === 'EXPENSE' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                      Recipient Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-3.5 text-slate-400" size={16} />
                      <input
                        name="recipient"
                        type="text"
                        placeholder="Name of person given cash"
                        className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                      Reference / Voucher #
                    </label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-3.5 text-slate-400" size={16} />
                      <input
                        name="reference"
                        type="text"
                        placeholder="e.g. CSR-012"
                        className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                  Memo / Description *
                </label>
                <textarea
                  name="description"
                  required
                  rows={2}
                  placeholder={txType === 'DISBURSEMENT' ? 'Funding details, e.g. Weekly vault replenishment' : 'Purpose of detailed cash expenditure...'}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>

              {txType === 'DISBURSEMENT' && (
                <div className="flex items-center gap-3 bg-sky-50 border border-sky-100 p-3 rounded-xl">
                  <input
                    id="linkJournal"
                    type="checkbox"
                    checked={linkJournalForDisbursement}
                    onChange={(e) => setLinkJournalForDisbursement(e.target.checked)}
                    className="h-4 w-4 rounded text-sky-600 focus:ring-sky-500"
                  />
                  <label htmlFor="linkJournal" className="text-xs font-semibold text-sky-950 cursor-pointer select-none">
                    Automatically post this disbursement to General Journal as cash outfow
                    <span className="block font-normal text-[10px] text-sky-600 mt-0.5">
                      Keeps books consistent by creating an outflow in "PETTY CASH" category.
                    </span>
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-slate-800 text-white text-xs font-bold rounded-xl shadow-md hover:bg-slate-900 transition mr-0"
                >
                  {submitting ? 'Saving record...' : 'Confirm Entry'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Bulk Retirement Form Modal */}
      {showRetirementModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-100"
          >
            <div className="bg-emerald-800 text-white px-6 py-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black tracking-tight">Retire & Post Petty Cash Expenses</h3>
                <p className="text-xs text-emerald-200 mt-1">
                  Marks selected items as RETIRED and aggregates total to General Journal.
                </p>
              </div>
              <button 
                onClick={() => setShowRetirementModal(false)}
                className="text-emerald-200 hover:text-white p-1 rounded-xl transition"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleBulkRetirement} className="p-6 space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  <span>Selected Records</span>
                  <span>Amount Sum</span>
                </div>
                <div className="flex justify-between items-center text-slate-900">
                  <span className="text-sm font-bold text-slate-700">
                    {selectedExpenseIds.length} Expense Transactions
                  </span>
                  <span className="text-lg font-black text-emerald-700">
                    ₦{transactions.filter(tx => selectedExpenseIds.includes(tx.id)).reduce((sum, tx) => sum + tx.amount, 0).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                    Posting Date *
                  </label>
                  <input
                    name="retiredDate"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().substring(0, 10)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                    Assign Journal Store *
                  </label>
                  <select
                    name="retiredWarehouseId"
                    required
                    defaultValue={profile?.assignedWarehouseId || ''}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    <option value="">Select Store</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                    Disbursement Method *
                  </label>
                  <select
                    name="paymentMethod"
                    required
                    defaultValue="CASH"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    <option value="CASH">Cash Vault Outflow</option>
                    <option value="BANK_TRANSFER">Bank Account Outflow</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                    Bank Vault Detail
                  </label>
                  <input
                    name="bankName"
                    type="text"
                    placeholder="e.g. First Bank (if Transfer)"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>
              </div>

              <div className="text-xs text-slate-400 flex items-start gap-2 pt-1">
                <AlertCircle size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  Retiring marks selected petty cash outlays as settled. A single consolidating transaction entry in General Journal will be created so cash counts track in parallel.
                </span>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowRetirementModal(false)}
                  className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={retiring}
                  className="px-5 py-2.5 bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md hover:bg-emerald-800 transition mr-0"
                >
                  {retiring ? 'Processing retirement...' : 'Complete Retirement'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

    </div>
  );
}
