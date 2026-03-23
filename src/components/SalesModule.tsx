/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  TrendingUp, 
  Users, 
  ArrowLeft, 
  Package, 
  Scale, 
  Droplets, 
  Calculator, 
  History,
  UserPlus,
  ArrowUpRight,
  ArrowDownRight,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CommodityType, Transaction, Buyer, DeductionParams, Warehouse } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, query, orderBy, where } from 'firebase/firestore';
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

const COMMODITIES: CommodityType[] = ['COCOA', 'CASHEW', 'PK'];
const BENCHMARKS = { COCOA: 8, CASHEW: 10, PK: 8 };

export default function SalesModule() {
  const { profile, isStaff, isAccount, isAdmin } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isAddingSale, setIsAddingSale] = useState(false);
  const [isAddingBuyer, setIsAddingBuyer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');

  // Success message auto-hide
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const [searchQuery, setSearchQuery] = useState('');
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);

  // Form State for Sale
  const [commodity, setCommodity] = useState<CommodityType>('COCOA');
  const [grossWeight, setGrossWeight] = useState<number | string>('');
  const [moistureActual, setMoistureActual] = useState<number | string>(8);
  const [moistureBenchmark, setMoistureBenchmark] = useState<number | string>(10);
  const [tareWeight, setTareWeight] = useState<number | string>('');
  const [moldWeight, setMoldWeight] = useState<number | string>('');
  const [otherDeduction, setOtherDeduction] = useState<number | string>('');

  // Load Data from Firestore
  useEffect(() => {
    if (!profile?.companyId) return;

    const qTx = query(
      collection(db, 'transactions'), 
      where('companyId', '==', profile.companyId),
      where('type', '==', 'SALE'), 
      orderBy('date', 'desc')
    );
    const unsubscribeTx = onSnapshot(qTx, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Transaction));
      setTransactions(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'transactions'));

    const qBuyers = query(
      collection(db, 'buyers'), 
      where('companyId', '==', profile.companyId),
      orderBy('name', 'asc')
    );
    const unsubscribeBuyers = onSnapshot(qBuyers, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Buyer));
      setBuyers(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'buyers'));

    const qWarehouses = query(
      collection(db, 'warehouses'), 
      where('companyId', '==', profile.companyId),
      orderBy('name', 'asc')
    );
    const unsubscribeWarehouses = onSnapshot(qWarehouses, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Warehouse));
      setWarehouses(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'warehouses'));

    const qAll = query(
      collection(db, 'transactions'),
      where('companyId', '==', profile.companyId)
    );
    const unsubscribeAll = onSnapshot(qAll, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Transaction);
      setAllTransactions(data);
    });

    return () => {
      unsubscribeTx();
      unsubscribeBuyers();
      unsubscribeWarehouses();
      unsubscribeAll();
    };
  }, [profile?.companyId]);

  // Inventory Summary (Calculated from all transactions)
  const inventory = useMemo(() => {
    const summary: Record<CommodityType, number> = { COCOA: 0, CASHEW: 0, PK: 0 };
    allTransactions.forEach(tx => {
      if (selectedWarehouseId) {
        if (tx.type === 'PURCHASE' && tx.warehouseId === selectedWarehouseId) summary[tx.commodity] += tx.netWeight;
        if (tx.type === 'SALE' && tx.warehouseId === selectedWarehouseId) summary[tx.commodity] -= tx.netWeight;
        if (tx.type === 'TRANSFER') {
          if (tx.sourceWarehouseId === selectedWarehouseId) summary[tx.commodity] -= tx.netWeight;
          if (tx.destinationWarehouseId === selectedWarehouseId) summary[tx.commodity] += tx.netWeight;
        }
      } else {
        if (tx.type === 'PURCHASE') summary[tx.commodity] += tx.netWeight;
        if (tx.type === 'SALE') summary[tx.commodity] -= tx.netWeight;
      }
    });
    return summary;
  }, [allTransactions, selectedWarehouseId]);

  // Calculation Logic
  const moistureLoss = useMemo(() => {
    const actual = Number(moistureActual) || 0;
    const benchmark = Number(moistureBenchmark) || 0;
    const gross = Number(grossWeight) || 0;
    return ((actual - benchmark) * gross) / 100;
  }, [moistureActual, moistureBenchmark, grossWeight]);

  const totalDeductions = moistureLoss + Number(tareWeight) + Number(moldWeight) + Number(otherDeduction);
  const netWeight = Math.max(0, Number(grossWeight) - totalDeductions);

  const handleAddBuyer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('handleAddBuyer triggered', { isStaff, submitting, companyId: profile?.companyId });
    if (!isStaff || submitting || !profile?.companyId) {
      console.warn('handleAddBuyer early exit', { isStaff, submitting, companyId: profile?.companyId });
      return;
    }

    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const id = crypto.randomUUID();
    const newBuyer: Buyer = {
      id,
      companyId: profile.companyId,
      name: formData.get('name') as string,
      phone: formData.get('phone') as string,
      location: formData.get('location') as string,
      previousBalance: 0,
      createdAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'buyers', id), newBuyer);
      setIsAddingBuyer(false);
      setSuccessMessage('Buyer successfully registered!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `buyers/${id}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddSale = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('handleAddSale triggered', { isStaff, submitting, companyId: profile?.companyId });
    if (!isStaff || submitting || !profile?.companyId) {
      console.warn('handleAddSale early exit', { isStaff, submitting, companyId: profile?.companyId });
      return;
    }

    // Check inventory availability
    const availableStock = inventory[commodity];
    if (netWeight > availableStock) {
      alert(`Insufficient inventory! Available ${commodity} stock is only ${(availableStock || 0).toLocaleString()} kg.`);
      return;
    }

    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const id = crypto.randomUUID();
    
    const newTx: Transaction = {
      id,
      companyId: profile.companyId,
      date: new Date().toISOString(),
      type: 'SALE',
      commodity,
      buyerId: formData.get('buyerId') as string,
      grossWeight,
      netWeight,
      bags: Number(formData.get('bags')) || 0,
      noOfBags: Number(formData.get('bags')) || 0,
      pricePerKg: Number(formData.get('price')) || 0,
      totalValue: netWeight * (Number(formData.get('price')) || 0),
      referenceId: `SL-${Date.now().toString().slice(-6)}`,
      warehouseId: selectedWarehouseId,
      deductions: {
        moistureActual,
        moistureBenchmark,
        tareWeight,
        moldWeight,
        otherDeduction
      }
    };

    try {
      await setDoc(doc(db, 'transactions', id), newTx);
      setIsAddingSale(false);
      resetForm();
      setSuccessMessage('Sale record successfully recorded!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `transactions/${id}`);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setGrossWeight('');
    setMoistureActual(8);
    setMoistureBenchmark(BENCHMARKS[commodity]);
    setTareWeight('');
    setMoldWeight('');
    setOtherDeduction('');
  };

  useEffect(() => {
    setMoistureBenchmark(BENCHMARKS[commodity]);
  }, [commodity]);

  const filteredSales = transactions.filter(tx => tx.type === 'SALE');

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

      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-slate-900">Sales Module</h1>
          <div className="flex gap-2">
            {isStaff && (
              <button
                onClick={() => setIsAddingBuyer(true)}
                className="bg-slate-100 text-slate-600 px-3 py-2 rounded-xl hover:bg-slate-200 transition-all flex items-center gap-2 text-xs font-bold"
                title="Add Buyer"
              >
                <UserPlus size={18} /> Add Buyer
              </button>
            )}
            <button
              onClick={() => setIsAddingSale(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-sm font-bold active:scale-95 transition-all"
            >
              <Plus size={18} /> New Sale
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
        <AnimatePresence mode="wait">
          {isAddingSale ? (
            <motion.div
              key="sale-form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold">Record New Sale</h2>
                <button onClick={() => setIsAddingSale(false)} className="text-slate-400">Cancel</button>
              </div>

              <form onSubmit={handleAddSale} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Warehouse</label>
                    <select 
                      value={selectedWarehouseId} 
                      onChange={(e) => setSelectedWarehouseId(e.target.value)}
                      required 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Warehouse</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Buyer</label>
                    <select name="buyerId" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Select Buyer</option>
                      {buyers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Commodity</label>
                    <select 
                      value={commodity} 
                      onChange={(e) => setCommodity(e.target.value as CommodityType)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                    >
                      {COMMODITIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">No of Bags</label>
                    <input name="bags" type="number" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="0" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Gross Weight (kg)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      required 
                      value={grossWeight} 
                      onChange={(e) => setGrossWeight(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-lg" 
                      placeholder="0.00" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Selling Price per kg (₦)</label>
                    <input name="price" type="number" step="0.01" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-lg" placeholder="0.00" />
                  </div>
                </div>

                {/* Deduction Logic (Same as Purchase) */}
                <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 space-y-4">
                  <h3 className="text-xs font-bold text-blue-800 flex items-center gap-2">
                    <Calculator size={14} /> Deduction Parameters
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-blue-600 uppercase mb-1">Actual Moisture (%)</label>
                      <input 
                        type="number" 
                        step="0.1" 
                        value={moistureActual} 
                        onChange={(e) => setMoistureActual(e.target.value)}
                        className="w-full px-4 py-2 bg-white border border-blue-200 rounded-lg outline-none text-sm" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-blue-600 uppercase mb-1">Benchmark (%)</label>
                      <input 
                        type="number" 
                        step="0.1" 
                        value={moistureBenchmark} 
                        onChange={(e) => setMoistureBenchmark(e.target.value)}
                        className="w-full px-4 py-2 bg-white border border-blue-200 rounded-lg outline-none text-sm" 
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-blue-600 uppercase mb-1">TARE (kg)</label>
                      <input 
                        type="number" 
                        step="0.1" 
                        value={tareWeight} 
                        onChange={(e) => setTareWeight(e.target.value)}
                        className="w-full px-4 py-2 bg-white border border-blue-200 rounded-lg outline-none text-sm" 
                      />
                    </div>
                  </div>
                </div>

                <div className={cn(
                  "rounded-2xl p-4 text-white flex flex-col gap-4 shadow-lg transition-all",
                  netWeight > inventory[commodity] ? "bg-rose-600" : "bg-blue-600"
                )}>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[10px] uppercase font-bold opacity-80">Final Net Weight</p>
                      <p className="text-2xl font-black">{netWeight.toFixed(2)} <span className="text-sm font-normal">kg</span></p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold opacity-80">Available {commodity} Stock</p>
                      <p className="text-xl font-black">
                        {(inventory[commodity] || 0).toLocaleString()} <span className="text-xs font-normal">kg</span>
                      </p>
                      {netWeight > inventory[commodity] && (
                        <p className="text-[9px] font-bold text-rose-200 mt-1 uppercase tracking-tighter animate-pulse">
                          Insufficient Stock
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="pt-3 border-t border-white/20 flex justify-between items-center">
                    <p className="text-[10px] uppercase font-bold opacity-80">Total Value</p>
                    <p className="text-lg font-bold">₦{(netWeight * (Number((document.querySelector('input[name="price"]') as HTMLInputElement)?.value) || 0) || 0).toLocaleString()}</p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? 'Confirming...' : 'Confirm Sale'}
                </button>
              </form>
            </motion.div>
          ) : isAddingBuyer ? (
            <motion.div
              key="buyer-form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold">Add New Buyer</h2>
                <button onClick={() => setIsAddingBuyer(false)} className="text-slate-400">Cancel</button>
              </div>
              <form onSubmit={handleAddBuyer} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Buyer Name</label>
                  <input required name="name" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="e.g. Export Co." />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Phone</label>
                  <input required name="phone" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="Phone number" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Location</label>
                  <input required name="location" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="City/State" />
                </div>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? 'Saving...' : 'Save Buyer'}
                </button>
              </form>
            </motion.div>
          ) : (
            <div className="space-y-6">
              {/* Sales History */}
              <section className="space-y-3">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <History size={16} /> Recent Sales
                </h2>
                <div className="space-y-3">
                  {filteredSales.length === 0 ? (
                    <div className="bg-white rounded-2xl p-8 border border-dashed border-slate-300 text-center">
                      <TrendingUp className="mx-auto text-slate-200 mb-2" size={32} />
                      <p className="text-xs text-slate-400">No sales recorded yet</p>
                    </div>
                  ) : (
                    filteredSales.map(tx => (
                      <div key={tx.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded uppercase">
                                {tx.commodity}
                              </span>
                              <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded uppercase">
                                {warehouses.find(w => w.id === tx.warehouseId)?.name || 'Main'}
                              </span>
                              <span className="text-[10px] text-slate-400">{new Date(tx.date).toLocaleDateString()}</span>
                            </div>
                            <h3 className="font-bold text-slate-900">
                              {buyers.find(b => b.id === tx.buyerId)?.name || 'Unknown Buyer'}
                            </h3>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-slate-900">{tx.netWeight.toFixed(2)} kg</p>
                            <p className="text-[10px] text-slate-400">Net Weight</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-50">
                          <div className="text-left">
                            <p className="text-[9px] text-slate-400 uppercase">Total Value</p>
                            <p className="text-[11px] font-bold text-blue-600">₦{(tx.totalValue || 0).toLocaleString()}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] text-slate-400 uppercase">Ref</p>
                            <p className="text-[11px] font-bold text-slate-600">{tx.referenceId}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
