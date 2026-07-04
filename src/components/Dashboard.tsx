/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  ShoppingCart, 
  TrendingUp, 
  TrendingDown,
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight,
  Plus,
  History,
  AlertCircle
} from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, limit, where } from 'firebase/firestore';
import { Transaction, Payment, JournalEntry, Supplier } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, OperationType } from '../lib/firestore';
import { roundTo, formatCurrency } from '../lib/utils';

interface DashboardProps {
  onNavigate: (module: any) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { profile, company, isSuperAdmin } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  React.useEffect(() => {
    if (!profile?.companyId || (company && !company.isApproved && !isSuperAdmin)) return;

    const qTx = query(
      collection(db, 'transactions'), 
      where('companyId', '==', profile.companyId)
    );
    const unsubscribeTx = onSnapshot(qTx, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Transaction));
      const sorted = data.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      setTransactions(sorted);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'transactions'));

    const qPayments = query(
      collection(db, 'payments'), 
      where('companyId', '==', profile.companyId)
    );
    const unsubscribePayments = onSnapshot(qPayments, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Payment));
      const sorted = data.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      setPayments(sorted);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'payments'));

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
      setJournal(sorted);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'journal'));

    const qSuppliers = query(
      collection(db, 'suppliers'),
      where('companyId', '==', profile.companyId)
    );
    const unsubscribeSuppliers = onSnapshot(qSuppliers, (snapshot) => {
      setSuppliers(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Supplier)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'suppliers'));

    return () => {
      unsubscribeTx();
      unsubscribePayments();
      unsubscribeJournal();
      unsubscribeSuppliers();
    };
  }, [profile?.companyId]);

  const stats = React.useMemo(() => {
    const activeTransactions = transactions.filter(t => !t.isDeleted);
    const activePayments = payments.filter(p => !p.isDeleted);
    const activeJournal = journal.filter(e => !e.isDeleted);

    const totalPurchases = activeTransactions.filter(t => t.type === 'PURCHASE').reduce((sum, t) => sum + roundTo(t.totalValue || 0, 2), 0);
    const totalSales = activeTransactions.filter(t => t.type === 'SALE').reduce((sum, t) => sum + roundTo(t.totalValue || 0, 2), 0);
    const totalPayments = activePayments.reduce((sum, p) => sum + roundTo(p.amount || 0, 2), 0);
    const totalInflow = activeJournal.filter(e => e.type === 'INFLOW').reduce((sum, e) => sum + roundTo(e.amount || 0, 2), 0);
    const totalOutflow = activeJournal.filter(e => e.type === 'OUTFLOW').reduce((sum, e) => sum + roundTo(e.amount || 0, 2), 0);

    // Calculate total supplier balance
    const totalSupplierBalance = suppliers.reduce((sum, s) => {
      const sTx = activeTransactions.filter(t => t.supplierId === s.id);
      const sPay = activePayments.filter(p => p.supplierId === s.id);
      const sExp = activeJournal.filter(e => e.supplierId === s.id);
      
      const sPurchases = sTx.filter(t => t.type === 'PURCHASE').reduce((sSum, t) => sSum + roundTo(t.totalValue || 0, 2), 0);
      const sReturns = sTx.filter(t => (t.type as string) === 'PURCHASE_RETURN').reduce((sSum, t) => sSum + roundTo(t.totalValue || 0, 2), 0);
      const sSales = sTx.filter(t => t.type === 'SALE').reduce((sSum, t) => sSum + roundTo(t.totalValue || 0, 2), 0);
      const sPayments = sPay.reduce((sSum, p) => sSum + roundTo(p.amount || 0, 2), 0);
      const sCharges = sExp.reduce((sSum, e) => {
        const isOutflow = e.type === 'OUTFLOW' && e.category !== 'SUPPLIER_EXPENSE_DEDUCTION';
        return sSum + roundTo(isOutflow ? Number(e.amount) || 0 : -Number(e.amount) || 0, 2);
      }, 0);
      
      const supplierBalance = roundTo((Number(s.previousBalance) || 0) + sPurchases - sReturns - sSales - sPayments - sCharges, 2);
      return roundTo(sum + supplierBalance, 2);
    }, 0);

    return {
      totalPurchases,
      totalSales,
      totalPayments,
      totalInflow,
      totalOutflow,
      totalSupplierBalance
    };
  }, [transactions, payments, journal, suppliers]);

  const recentActivity = React.useMemo(() => {
    const activeTransactions = transactions.filter(t => !t.isDeleted);
    const activePayments = payments.filter(p => !p.isDeleted);
    const activeJournal = journal.filter(e => !e.isDeleted);

    const activities = [
      ...activeTransactions.map(t => ({
        id: `tx-${t.id}`,
        type: t.type === 'PURCHASE' ? 'PURCHASE' : 'SALE',
        title: `${t.type === 'PURCHASE' ? 'Purchase' : 'Sale'}: ${t.commodity}`,
        amount: t.totalValue || 0,
        date: t.date,
        icon: t.type === 'PURCHASE' ? ArrowUpRight : ArrowDownRight,
        color: t.type === 'PURCHASE' ? 'text-emerald-600' : 'text-blue-600',
        bgColor: t.type === 'PURCHASE' ? 'bg-emerald-50' : 'bg-blue-50'
      })),
      ...activePayments.map(p => ({
        id: `pay-${p.id}`,
        type: 'PAYMENT',
        title: `Payment: ${p.method}`,
        amount: p.amount,
        date: p.date,
        icon: Wallet,
        color: 'text-amber-600',
        bgColor: 'bg-amber-50'
      })),
      ...activeJournal.map(e => ({
        id: `jr-${e.id}`,
        type: e.type,
        title: `${e.type === 'INFLOW' ? 'Inflow' : 'Outflow'}: ${e.category}`,
        amount: e.amount,
        date: e.date,
        icon: e.type === 'INFLOW' ? ArrowUpRight : ArrowDownRight,
        color: e.type === 'INFLOW' ? 'text-emerald-600' : 'text-rose-600',
        bgColor: e.type === 'INFLOW' ? 'bg-emerald-50' : 'bg-rose-50'
      }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

    return activities;
  }, [transactions, payments, journal]);

  return (
    <div className="p-4 space-y-6 bg-[var(--bg-app)] min-h-full pb-24">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="google-card p-4"
        >
          <div className="bg-blue-100 w-8 h-8 rounded-lg flex items-center justify-center text-[var(--accent)] mb-3">
            <TrendingUp size={18} />
          </div>
          <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-secondary)] mb-1">Total Sales</p>
          <p className="text-lg font-bold text-[var(--text-primary)]">{formatCurrency(stats.totalSales || 0)}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="google-card p-4"
        >
          <div className="bg-rose-100 w-8 h-8 rounded-lg flex items-center justify-center text-rose-600 mb-3">
            <TrendingDown size={18} />
          </div>
          <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-secondary)] mb-1">Total Purchases</p>
          <p className="text-lg font-bold text-[var(--text-primary)]">{formatCurrency(stats.totalPurchases || 0)}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="google-card p-4"
        >
          <div className="bg-emerald-100 w-8 h-8 rounded-lg flex items-center justify-center text-emerald-600 mb-3">
            <TrendingUp size={18} />
          </div>
          <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-secondary)] mb-1">Total Inflow</p>
          <p className="text-lg font-bold text-[var(--text-primary)]">{formatCurrency(stats.totalInflow || 0)}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="google-card p-4"
        >
          <div className="bg-rose-100 w-8 h-8 rounded-lg flex items-center justify-center text-rose-600 mb-3">
            <TrendingDown size={18} />
          </div>
          <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-secondary)] mb-1">Total Outflow</p>
          <p className="text-lg font-bold text-[var(--text-primary)]">{formatCurrency(stats.totalOutflow || 0)}</p>
        </motion.div>
      </div>

      {/* Accounts Payable Highlight */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[var(--text-primary)] rounded-[var(--radius-lg)] p-6 text-white shadow-lg flex items-center justify-between overflow-hidden relative"
      >
        <div className="relative z-10">
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">Total Accounts Payable</p>
          <h2 className="text-3xl font-bold">{formatCurrency(stats.totalSupplierBalance || 0)}</h2>
          <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
            <AlertCircle size={10} /> Total outstanding balance to all suppliers
          </p>
        </div>
        <Wallet className="absolute -right-4 -bottom-4 text-white/5 w-32 h-32" />
      </motion.div>

      {/* Recent Activity */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">Recent Activity</h2>
        <div className="space-y-3">
          {recentActivity.map((activity, i) => (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="google-card p-4 flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 ${activity.bgColor} ${activity.color} rounded-xl flex items-center justify-center`}>
                  <activity.icon size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-[var(--text-primary)]">{activity.title}</h3>
                  <p className="text-xs text-[var(--text-secondary)]">{activity.date ? new Date(activity.date).toLocaleString() : 'N/A'}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-bold ${activity.color}`}>
                  {activity.type === 'PURCHASE' || activity.type === 'EXPENSE' ? '-' : '+'}{formatCurrency(activity.amount || 0)}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Quick Actions */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">Quick Actions</h2>
        <div className="grid grid-cols-4 gap-4">
          {[
            { icon: ShoppingCart, label: 'Buy', color: 'bg-emerald-50 text-emerald-600', module: 'purchases' },
            { icon: TrendingUp, label: 'Sell', color: 'bg-blue-50 text-blue-600', module: 'sales' },
            { icon: Wallet, label: 'Pay', color: 'bg-amber-50 text-amber-600', module: 'suppliers' },
            { icon: Users, label: 'Suppliers', color: 'bg-purple-50 text-purple-600', module: 'suppliers' },
          ].map((action) => (
            <div key={action.label} className="flex flex-col items-center gap-2">
              <button 
                onClick={() => onNavigate(action.module)}
                className={`${action.color} w-12 h-12 rounded-xl flex items-center justify-center shadow-sm active:scale-95 transition-all border border-transparent hover:border-current`}
              >
                <action.icon size={20} />
              </button>
              <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">{action.label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
