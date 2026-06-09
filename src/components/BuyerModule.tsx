/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Plus, Search, MapPin, Phone, Trash2, Edit2, ArrowLeft, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Buyer } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, query, orderBy, where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, reportFirestoreError, formatFirestoreError, OperationType } from '../lib/firestore';
import { recordAuditLog, AuditAction } from '../lib/audit';
import Toast from './Toast';
import ConfirmModal from './ConfirmModal';
import { cn, formatNumber } from '../lib/utils';
import BuyerDetails from './BuyerDetails';

export default function BuyerModule() {
  const { profile, isStaff, isAdmin } = useAuth();
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingBuyer, setEditingBuyer] = useState<Buyer | null>(null);
  const [selectedBuyer, setSelectedBuyer] = useState<Buyer | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Load from Firestore
  useEffect(() => {
    if (!profile?.companyId) return;

    const q = query(
      collection(db, 'buyers'), 
      where('companyId', '==', profile.companyId)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Buyer));
      const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
      setBuyers(sorted);
    }, (error) => {
      setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'buyers'));
    });

    return () => unsubscribe();
  }, [profile?.companyId]);

  const handleAddBuyer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isStaff || !profile?.companyId) return;

    const formData = new FormData(e.currentTarget);
    const id = editingBuyer?.id || crypto.randomUUID();
    
    const newBuyer: any = {
      id,
      companyId: profile.companyId,
      name: formData.get('name') as string,
      phone: formData.get('phone') as string,
      location: formData.get('location') as string,
      previousBalance: Number(formData.get('previousBalance')) || 0,
      createdAt: editingBuyer?.createdAt || new Date().toISOString(),
    };

    // Clean up undefined values
    Object.keys(newBuyer).forEach(key => newBuyer[key] === undefined && delete newBuyer[key]);

    try {
      await setDoc(doc(db, 'buyers', id), newBuyer);
      setIsAdding(false);
      setEditingBuyer(null);
      setSuccessMessage(editingBuyer ? 'Buyer updated successfully!' : 'Buyer added successfully!');
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, editingBuyer ? OperationType.UPDATE : OperationType.CREATE, `buyers/${id}`));
    }
  };

  const deleteBuyer = async (id: string) => {
    if (!isAdmin) {
      setErrorMessage('Only Admins can delete buyers.');
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
      await updateDoc(doc(db, 'buyers', deleteConfirmId), updateData);
      
      recordAuditLog({
        companyId: profile.companyId,
        userId: profile.uid,
        userEmail: profile.email,
        action: AuditAction.DELETE,
        module: 'Buyers',
        recordId: deleteConfirmId,
        details: `Deleted (Soft) buyer: ${buyers.find(b => b.id === deleteConfirmId)?.name || deleteConfirmId}. Reason: ${reason}`
      }).catch(err => console.error('Audit log failed:', err));

      setSuccessMessage('Buyer deleted successfully!');
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, OperationType.UPDATE, `buyers/${deleteConfirmId}`));
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const filteredBuyers = buyers.filter(b => 
    !b.isDeleted && (
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.phone.includes(searchQuery) ||
      b.location.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  if (selectedBuyer) {
    return <BuyerDetails buyer={selectedBuyer} onBack={() => setSelectedBuyer(null)} />;
  }

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
        title="Delete Buyer"
        message="Are you sure you want to delete this buyer? This will hide them from current views but preserve history."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirmId(null)}
        confirmText="Delete"
        type="danger"
        requireReason={true}
      />
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-slate-900">Buyers / Customers</h1>
          {!isAdding && !editingBuyer && isStaff && (
            <button
              onClick={() => setIsAdding(true)}
              className="bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
              id="add-buyer-btn"
            >
              <Plus size={24} />
            </button>
          )}
        </div>

        {!isAdding && !editingBuyer && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by name, phone or location..."
              className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-blue-500 transition-all text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          {isAdding || editingBuyer ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200"
            >
              <div className="flex items-center gap-2 mb-6">
                <button 
                  onClick={() => { setIsAdding(false); setEditingBuyer(null); }}
                  className="text-slate-500 hover:text-slate-900"
                >
                  <ArrowLeft size={20} />
                </button>
                <h2 className="text-lg font-semibold">
                  {editingBuyer ? 'Edit Buyer' : 'Add New Buyer'}
                </h2>
              </div>

              <form onSubmit={handleAddBuyer} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Buyer Name</label>
                  <input
                    required
                    name="name"
                    defaultValue={editingBuyer?.name}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="e.g. Export International"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Phone Number</label>
                    <input
                      required
                      name="phone"
                      type="tel"
                      defaultValue={editingBuyer?.phone}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      placeholder="e.g. +234..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Location</label>
                    <input
                      required
                      name="location"
                      defaultValue={editingBuyer?.location}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      placeholder="e.g. Lagos, Nigeria"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Previous Balance (₦)</label>
                  <input
                    name="previousBalance"
                    type="number"
                    step="0.01"
                    defaultValue={editingBuyer?.previousBalance}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="0.00"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Positive for Debit (they owe us), Negative for Credit (we owe them)</p>
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all transform active:scale-[0.98] mt-4"
                >
                  {editingBuyer ? 'Update Buyer' : 'Save Buyer'}
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
              {filteredBuyers.length === 0 ? (
                <div className="text-center py-20">
                  <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <UserPlus className="text-slate-300" size={32} />
                  </div>
                  <p className="text-slate-500 font-medium">No buyers found</p>
                  <button 
                    onClick={() => setIsAdding(true)}
                    className="text-blue-600 text-sm font-bold mt-2"
                  >
                    Add your first buyer
                  </button>
                </div>
              ) : (
                filteredBuyers.map((buyer) => (
                  <motion.div
                    layout
                    key={buyer.id}
                    onClick={() => setSelectedBuyer(buyer)}
                    className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 group relative overflow-hidden transition-colors cursor-pointer hover:border-blue-200"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-slate-900">{buyer.name}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <Phone size={12} /> {buyer.phone}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <MapPin size={12} /> {buyer.location}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={cn(
                          "text-sm font-bold",
                          buyer.previousBalance >= 0 ? "text-blue-600" : "text-rose-600"
                        )}>
                          {buyer.previousBalance >= 0 ? '+' : ''}{formatNumber(buyer.previousBalance || 0)}
                        </span>
                        <p className="text-[10px] text-slate-400 uppercase tracking-tighter">Balance</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-end mt-4 pt-4 border-t border-slate-50 gap-2">
                      {isStaff && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingBuyer(buyer); }}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        >
                          <Edit2 size={16} />
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteBuyer(buyer.id); }}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
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
