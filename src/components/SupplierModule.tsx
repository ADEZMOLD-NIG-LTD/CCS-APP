/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Plus, Search, MapPin, Phone, Landmark, Trash2, Edit2, ChevronRight, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Supplier, Transaction, Payment, JournalEntry } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, query, orderBy, where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, reportFirestoreError, formatFirestoreError, OperationType } from '../lib/firestore';
import { recordAuditLog, AuditAction } from '../lib/audit';
import Toast from './Toast';
import ConfirmModal from './ConfirmModal';
import { cn, formatNumber, formatCurrency } from '../lib/utils';
import { DigitFormattedInput } from './DigitFormattedInput';

import SupplierDetails from './SupplierDetails';

export default function SupplierModule() {
  const { profile, company, isStaff, isAccount, isAdmin, isOnline } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Success message auto-hide
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const [searchQuery, setSearchQuery] = useState('');
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  // Load from Firestore
  useEffect(() => {
    if (!profile?.companyId) return;

    const q = query(
      collection(db, 'suppliers'), 
      where('companyId', '==', profile.companyId)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Supplier));
      const sorted = data.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setSuppliers(sorted);
    }, (error) => {
      setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'suppliers'));
    });

    return () => unsubscribe();
  }, [profile?.companyId]);

  // Load transactions, payments, journal to compute live balances
  useEffect(() => {
    if (!profile?.companyId) return;

    const qTx = query(
      collection(db, 'transactions'), 
      where('companyId', '==', profile.companyId)
    );
    const unsubscribeTx = onSnapshot(qTx, (snapshot) => {
      const data = snapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id } as Transaction))
        .filter(tx => !tx.isDeleted);
      setTransactions(data);
    }, (error) => console.error('Failed to load transactions for balances:', error));

    const qPayments = query(
      collection(db, 'payments'), 
      where('companyId', '==', profile.companyId)
    );
    const unsubscribePayments = onSnapshot(qPayments, (snapshot) => {
      const data = snapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id } as Payment))
        .filter(p => !p.isDeleted);
      setPayments(data);
    }, (error) => console.error('Failed to load payments for balances:', error));

    const qJournal = query(
      collection(db, 'journal'), 
      where('companyId', '==', profile.companyId)
    );
    const unsubscribeJournal = onSnapshot(qJournal, (snapshot) => {
      const data = snapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id } as JournalEntry))
        .filter(j => !j.isDeleted);
      setJournal(data);
    }, (error) => console.error('Failed to load journal for balances:', error));

    return () => {
      unsubscribeTx();
      unsubscribePayments();
      unsubscribeJournal();
    };
  }, [profile?.companyId]);

  const getSupplierBalance = (sId: string, previousBalance: number) => {
    const sTx = transactions.filter(t => t.supplierId === sId);
    const sPay = payments.filter(p => p.supplierId === sId);
    const sExp = journal.filter(e => e.supplierId === sId && e.type === 'OUTFLOW');

    const sPurchases = sTx.filter(t => t.type === 'PURCHASE').reduce((sum, t) => sum + (Number(t.totalValue) || 0), 0);
    const sSales = sTx.filter(t => t.type === 'SALE').reduce((sum, t) => sum + (Number(t.totalValue) || 0), 0);
    const sPayments = sPay.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const sCharges = sExp.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    return (Number(previousBalance) || 0) + sPurchases - sSales - sPayments - sCharges;
  };

  const handleAddSupplier = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('handleAddSupplier triggered', { isStaff, submitting, companyId: profile?.companyId });
    if (!isStaff || submitting || !profile?.companyId) {
      console.warn('handleAddSupplier early exit', { isStaff, submitting, companyId: profile?.companyId });
      return;
    }

    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const id = editingSupplier?.id || crypto.randomUUID();
    
    const newSupplier: any = {
      id,
      companyId: profile.companyId,
      name: formData.get('name') as string,
      phone: formData.get('phone') as string,
      location: formData.get('location') as string,
      bankName: (formData.get('bankName') as string) || '',
      accountNumber: (formData.get('accountNumber') as string) || '',
      accountName: (formData.get('accountName') as string) || '',
      previousBalance: Number(formData.get('previousBalance')) || 0,
      createdAt: editingSupplier?.createdAt || new Date().toISOString(),
    };

    // Clean up undefined values
    Object.keys(newSupplier).forEach(key => newSupplier[key] === undefined && delete newSupplier[key]);

    try {
      const writePromise = setDoc(doc(db, 'suppliers', id), newSupplier);
      
      // If offline, we don't wait for the server to acknowledge.
      // Firestore will sync it in the background.
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
        action: editingSupplier ? AuditAction.UPDATE : AuditAction.CREATE,
        module: 'Suppliers',
        recordId: id,
        details: `${editingSupplier ? 'Updated' : 'Created'} supplier: ${newSupplier.name}`,
        newData: newSupplier,
        previousData: editingSupplier || undefined
      }).catch(err => console.error('Audit log failed:', err));

      setIsAdding(false);
      setEditingSupplier(null);
      setSuccessMessage(editingSupplier ? 'Supplier updated successfully!' : 'Supplier added successfully!');
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, editingSupplier ? OperationType.UPDATE : OperationType.CREATE, `suppliers/${id}`));
    } finally {
      setSubmitting(false);
    }
  };

  const deleteSupplier = async (id: string) => {
    if (!isAdmin) {
      setErrorMessage('Only Admins can delete suppliers.');
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
      await updateDoc(doc(db, 'suppliers', deleteConfirmId), updateData);
      
      recordAuditLog({
        companyId: profile.companyId,
        userId: profile.uid,
        userEmail: profile.email,
        action: AuditAction.DELETE,
        module: 'Suppliers',
        recordId: deleteConfirmId,
        details: `Deleted (Soft) supplier: ${suppliers.find(s => s.id === deleteConfirmId)?.name || deleteConfirmId}. Reason: ${reason}`
      }).catch(err => console.error('Audit log failed:', err));

      setSuccessMessage('Supplier deleted successfully!');
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, OperationType.UPDATE, `suppliers/${deleteConfirmId}`));
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const filteredSuppliers = suppliers.filter(s => 
    !s.isDeleted && (
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.phone.includes(searchQuery) ||
      s.location.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  if (selectedSupplier) {
    return <SupplierDetails supplier={selectedSupplier} onBack={() => setSelectedSupplier(null)} />;
  }

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
        title="Delete Supplier"
        message="Are you sure you want to delete this supplier? This will hide them from current views but preserve history."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirmId(null)}
        confirmText="Delete"
        type="danger"
        requireReason={true}
      />

      {/* Header */}
      <header className="bg-white border-b border-[var(--border)] px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Suppliers</h1>
          {!isAdding && !editingSupplier && isStaff && (
            <button
              onClick={() => setIsAdding(true)}
              className="google-btn-primary flex items-center gap-2"
              id="add-supplier-btn"
            >
              <Plus size={20} />
              <span>Add Supplier</span>
            </button>
          )}
        </div>

        {!isAdding && !editingSupplier && (
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={18} />
            <input
              type="text"
              placeholder="Search by name, phone or location..."
              className="w-full pl-12 pr-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-[var(--accent)] transition-all text-sm font-medium"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          {isAdding || editingSupplier ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="google-card p-6"
            >
              <div className="flex items-center gap-2 mb-6">
                <button 
                  onClick={() => { setIsAdding(false); setEditingSupplier(null); }}
                  className="text-slate-500 hover:text-slate-900"
                >
                  <ArrowLeft size={20} />
                </button>
                <h2 className="text-lg font-semibold">
                  {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
                </h2>
              </div>

              <form onSubmit={handleAddSupplier} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Full Name</label>
                  <input
                    required
                    name="name"
                    defaultValue={editingSupplier?.name}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    placeholder="e.g. John Doe"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Phone Number</label>
                    <input
                      required
                      name="phone"
                      type="tel"
                      defaultValue={editingSupplier?.phone}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      placeholder="e.g. +234..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Location</label>
                    <input
                      required
                      name="location"
                      defaultValue={editingSupplier?.location}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      placeholder="e.g. Kumasi, Ghana"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4">
                  <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Landmark size={16} /> Bank Details
                  </h3>
                  <div className="space-y-3">
                    <input
                      name="bankName"
                      defaultValue={editingSupplier?.bankName}
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                      placeholder="Bank Name"
                    />
                    <input
                      name="accountNumber"
                      defaultValue={editingSupplier?.accountNumber}
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                      placeholder="Account Number"
                    />
                    <input
                      name="accountName"
                      defaultValue={editingSupplier?.accountName}
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                      placeholder="Account Name"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Previous Balance (Stock/Cash)</label>
                  <DigitFormattedInput
                    name="previousBalance"
                    defaultValue={editingSupplier?.previousBalance}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    placeholder="0.00"
                    prefix="₦"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Positive for Credit (we owe), Negative for Debit (they owe)</p>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-emerald-700 transition-all transform active:scale-[0.98] mt-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? 'Saving...' : (editingSupplier ? 'Update Supplier' : 'Save Supplier')}
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3"
            >
              {filteredSuppliers.length === 0 ? (
                <div className="text-center py-20">
                  <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="text-slate-300" size={32} />
                  </div>
                  <p className="text-slate-500 font-medium">No suppliers found</p>
                  <button 
                    onClick={() => setIsAdding(true)}
                    className="text-emerald-600 text-sm font-bold mt-2"
                  >
                    Add your first supplier
                  </button>
                </div>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <motion.div
                    layout
                    key={supplier.id}
                    onClick={() => setSelectedSupplier(supplier)}
                    className="google-card p-4 group relative overflow-hidden cursor-pointer active:bg-slate-50 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-[var(--text-primary)]">{supplier.name}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                            <Phone size={12} /> {supplier.phone}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                            <MapPin size={12} /> {supplier.location}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={cn(
                           "text-sm font-bold",
                           getSupplierBalance(supplier.id, supplier.previousBalance) >= 0 ? "text-emerald-600" : "text-rose-600"
                        )}>
                          {getSupplierBalance(supplier.id, supplier.previousBalance) >= 0 ? '+' : ''}{formatNumber(getSupplierBalance(supplier.id, supplier.previousBalance))}
                        </span>
                        <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-tighter">Balance</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-50">
                      <div className="flex items-center gap-2">
                        <Landmark size={14} className="text-[var(--text-secondary)]" />
                        <span className="text-[10px] font-medium text-[var(--text-secondary)] truncate max-w-[150px]">
                          {supplier.bankName || 'No bank details'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isStaff && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingSupplier(supplier); }}
                            className="p-2 text-slate-400 hover:text-[var(--accent)] hover:bg-blue-50 rounded-lg transition-all"
                          >
                            <Edit2 size={16} />
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteSupplier(supplier.id); }}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                        <button className="p-2 text-slate-400 hover:text-[var(--text-primary)] rounded-lg transition-all">
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
