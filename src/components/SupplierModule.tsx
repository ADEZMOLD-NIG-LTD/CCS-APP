/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Plus, Search, MapPin, Phone, Landmark, Trash2, Edit2, ChevronRight, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Supplier } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, orderBy, where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    timestamp: new Date().toISOString()
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  alert(`Database Error (${operationType}): Please check your connection or permissions.`);
}

import SupplierDetails from './SupplierDetails';

export default function SupplierModule() {
  const { profile, company, isStaff, isAccount, isAdmin } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
      where('companyId', '==', profile.companyId),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Supplier));
      setSuppliers(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'suppliers');
    });

    return () => unsubscribe();
  }, [profile?.companyId]);

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
    
    const newSupplier: Supplier = {
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

    try {
      await setDoc(doc(db, 'suppliers', id), newSupplier);
      setIsAdding(false);
      setEditingSupplier(null);
      setSuccessMessage(editingSupplier ? 'Supplier updated successfully!' : 'Supplier added successfully!');
    } catch (error) {
      handleFirestoreError(error, editingSupplier ? OperationType.UPDATE : OperationType.CREATE, `suppliers/${id}`);
    } finally {
      setSubmitting(false);
    }
  };

  const deleteSupplier = async (id: string) => {
    if (!isAdmin) {
      alert('Only Admins can delete suppliers.');
      return;
    }

    if (confirm('Are you sure you want to delete this supplier?')) {
      try {
        await deleteDoc(doc(db, 'suppliers', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `suppliers/${id}`);
      }
    }
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.phone.includes(searchQuery) ||
    s.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (selectedSupplier) {
    return <SupplierDetails supplier={selectedSupplier} onBack={() => setSelectedSupplier(null)} />;
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Success Toast */}
      <AnimatePresence>
        {successMessage && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-4 right-4 bg-emerald-600 text-white p-4 rounded-2xl shadow-2xl z-[100] flex items-center gap-3"
          >
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <Plus size={18} className="rotate-45" />
            </div>
            <p className="font-bold text-sm">{successMessage}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-slate-900">Suppliers</h1>
          {!isAdding && !editingSupplier && isStaff && (
            <button
              onClick={() => setIsAdding(true)}
              className="bg-emerald-600 text-white p-2 rounded-full shadow-lg hover:bg-emerald-700 transition-colors"
              id="add-supplier-btn"
            >
              <Plus size={24} />
            </button>
          )}
        </div>

        {!isAdding && !editingSupplier && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by name, phone or location..."
              className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
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
              className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200"
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
                  <input
                    name="previousBalance"
                    type="number"
                    step="0.01"
                    defaultValue={editingSupplier?.previousBalance}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    placeholder="0.00"
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
                    className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 group relative overflow-hidden cursor-pointer active:bg-slate-50 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-slate-900">{supplier.name}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <Phone size={12} /> {supplier.phone}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <MapPin size={12} /> {supplier.location}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={cn(
                          "text-sm font-bold",
                          supplier.previousBalance >= 0 ? "text-emerald-600" : "text-rose-600"
                        )}>
                          {supplier.previousBalance >= 0 ? '+' : ''}{(supplier.previousBalance || 0).toLocaleString()}
                        </span>
                        <p className="text-[10px] text-slate-400 uppercase tracking-tighter">Balance</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-50">
                      <div className="flex items-center gap-2">
                        <Landmark size={14} className="text-slate-400" />
                        <span className="text-[10px] font-medium text-slate-600 truncate max-w-[150px]">
                          {supplier.bankName || 'No bank details'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isStaff && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingSupplier(supplier); }}
                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
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
                        <button className="p-2 text-slate-400 hover:text-slate-900 rounded-lg transition-all">
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
