/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Warehouse as WarehouseIcon, 
  Plus, 
  MapPin, 
  Trash2,
  Building2,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Warehouse } from '../types';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, orderBy, where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

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

export default function WarehouseModule() {
  const { profile, company, isStaff, isAdmin } = useAuth();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (!profile?.companyId) return;

    const q = query(
      collection(db, 'warehouses'), 
      where('companyId', '==', profile.companyId),
      orderBy('name', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Warehouse));
      setWarehouses(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'warehouses'));

    return () => unsubscribe();
  }, [profile?.companyId]);

  const handleAddWarehouse = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('handleAddWarehouse triggered', { isStaff, submitting, companyId: profile?.companyId });
    if (!isStaff || submitting || !profile?.companyId) {
      console.warn('handleAddWarehouse early exit', { isStaff, submitting, companyId: profile?.companyId });
      return;
    }

    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const id = crypto.randomUUID();
    const newWarehouse: Warehouse = {
      id,
      companyId: profile.companyId,
      name: formData.get('name') as string,
      location: formData.get('location') as string,
    };

    try {
      await setDoc(doc(db, 'warehouses', id), newWarehouse);
      setIsAdding(false);
      setSuccessMessage('Warehouse successfully added!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `warehouses/${id}`);
    } finally {
      setSubmitting(false);
    }
  };

  const deleteWarehouse = async (id: string) => {
    if (!isAdmin) return;
    if (confirm('Are you sure you want to delete this warehouse? This will not delete transactions associated with it.')) {
      try {
        await deleteDoc(doc(db, 'warehouses', id));
        setSuccessMessage('Warehouse deleted.');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `warehouses/${id}`);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
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

      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">Warehouses</h1>
          {isStaff && (
            <button
              onClick={() => setIsAdding(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-sm font-bold active:scale-95 transition-all"
            >
              <Plus size={18} /> Add Warehouse
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
        <AnimatePresence mode="wait">
          {isAdding ? (
            <motion.div
              key="warehouse-form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold">New Warehouse</h2>
                <button onClick={() => setIsAdding(false)} className="text-slate-400">Cancel</button>
              </div>
              <form onSubmit={handleAddWarehouse} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Warehouse Name</label>
                  <input required name="name" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Main Warehouse" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Location</label>
                  <input required name="location" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Lagos, Nigeria" />
                </div>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? 'Adding...' : 'Add Warehouse'}
                </button>
              </form>
            </motion.div>
          ) : (
            <div className="grid gap-4">
              {warehouses.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 border border-dashed border-slate-300 text-center">
                  <WarehouseIcon className="mx-auto text-slate-200 mb-2" size={48} />
                  <p className="text-sm text-slate-400">No warehouses registered yet</p>
                </div>
              ) : (
                warehouses.map(w => (
                  <div key={w.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                        <Building2 size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">{w.name}</h3>
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <MapPin size={12} /> {w.location}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isAdmin && (
                        <button 
                          onClick={() => deleteWarehouse(w.id)}
                          className="p-2 text-slate-300 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                      <ChevronRight size={20} className="text-slate-300" />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
