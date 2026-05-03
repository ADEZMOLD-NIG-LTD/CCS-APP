/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Package, 
  Users, 
  ArrowUpRight, 
  ArrowDownRight, 
  Scale, 
  Droplets,
  PieChart as PieChartIcon,
  Calendar,
  Filter
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { Transaction, JournalEntry, CommodityType } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { handleFirestoreError, reportFirestoreError, formatFirestoreError, OperationType } from '../lib/firestore';
import Toast from './Toast';
import { cn, roundTo, formatCurrency, getWeightInKg } from '../lib/utils';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AnalyticsModule() {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [timeRange, setTimeRange] = useState<'7D' | '30D' | 'ALL'>('30D');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load Data from Firestore
  React.useEffect(() => {
    if (!profile?.companyId) return;

    const qTx = query(
      collection(db, 'transactions'), 
      where('companyId', '==', profile.companyId),
      orderBy('date', 'desc')
    );
    const unsubscribeTx = onSnapshot(qTx, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as Transaction);
      setTransactions(data);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'transactions')));

    const qJournal = query(
      collection(db, 'journal'), 
      where('companyId', '==', profile.companyId),
      orderBy('date', 'desc')
    );
    const unsubscribeJournal = onSnapshot(qJournal, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data() as JournalEntry);
      setJournal(data);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'journal')));

    return () => {
      unsubscribeTx();
      unsubscribeJournal();
    };
  }, [profile?.companyId]);

  // Filtered Data based on timeRange
  const filteredTx = React.useMemo(() => {
    if (timeRange === 'ALL') return transactions;
    const now = new Date();
    const days = timeRange === '7D' ? 7 : 30;
    const cutoff = new Date(now.setDate(now.getDate() - days));
    return transactions.filter(tx => new Date(tx.date) >= cutoff);
  }, [transactions, timeRange]);

  const filteredJournal = React.useMemo(() => {
    if (timeRange === 'ALL') return journal;
    const now = new Date();
    const days = timeRange === '7D' ? 7 : 30;
    const cutoff = new Date(now.setDate(now.getDate() - days));
    return journal.filter(e => new Date(e.date) >= cutoff);
  }, [journal, timeRange]);

  // KPI Calculations
  const totalPurchaseValue = React.useMemo(() => 
    filteredTx.filter(tx => tx.type === 'PURCHASE').reduce((sum, tx) => sum + roundTo(tx.totalValue || 0, 2), 0), 
  [filteredTx]);

  const totalSalesValue = React.useMemo(() => 
    filteredTx.filter(tx => tx.type === 'SALE').reduce((sum, tx) => sum + roundTo(tx.totalValue || 0, 2), 0), 
  [filteredTx]);

  const totalInflowValue = React.useMemo(() => 
    filteredJournal.filter(e => e.type === 'INFLOW').reduce((sum, e) => sum + roundTo(e.amount || 0, 2), 0), 
  [filteredJournal]);

  const totalOutflowValue = React.useMemo(() => 
    filteredJournal.filter(e => e.type === 'OUTFLOW').reduce((sum, e) => sum + roundTo(e.amount || 0, 2), 0), 
  [filteredJournal]);

  const grossProfit = roundTo((totalSalesValue + totalInflowValue) - (totalPurchaseValue + totalOutflowValue), 2);

  // Commodity Distribution (Pie Chart)
  const commodityData = React.useMemo(() => {
    const distribution: Record<string, number> = {};
    filteredTx.filter(tx => tx.type === 'PURCHASE').forEach(tx => {
      const weightKg = getWeightInKg(tx.netWeight || 0);
      distribution[tx.commodity] = (distribution[tx.commodity] || 0) + weightKg;
    });
    return Object.entries(distribution).map(([name, value]) => ({ name, value }));
  }, [filteredTx]);

  // Daily Volume (Bar Chart)
  const dailyVolumeData = React.useMemo(() => {
    const daily: Record<string, { date: string, purchase: number, sale: number }> = {};
    filteredTx.forEach(tx => {
      const date = new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const weightKg = getWeightInKg(tx.netWeight || 0);
      if (!daily[date]) daily[date] = { date, purchase: 0, sale: 0 };
      if (tx.type === 'PURCHASE') daily[date].purchase += weightKg;
      if (tx.type === 'SALE') daily[date].sale += weightKg;
    });
    return Object.values(daily).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filteredTx]);

  // Outflow Categories (Pie Chart)
  const outflowCategoryData = React.useMemo(() => {
    const distribution: Record<string, number> = {};
    filteredJournal.filter(e => e.type === 'OUTFLOW').forEach(e => {
      distribution[e.category] = (distribution[e.category] || 0) + e.amount;
    });
    return Object.entries(distribution).map(([name, value]) => ({ name, value }));
  }, [filteredJournal]);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <AnimatePresence>
        {errorMessage && (
          <Toast 
            message={errorMessage} 
            type="error" 
            onClose={() => setErrorMessage(null)} 
          />
        )}
      </AnimatePresence>
      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-slate-900">Advanced Analytics</h1>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {(['7D', '30D', 'ALL'] as const).map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                  timeRange === range ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"
                )}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                <TrendingUp size={14} />
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Sales</p>
            </div>
            <h3 className="text-lg font-black text-slate-900">{formatCurrency(totalSalesValue || 0)}</h3>
          </div>
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
                <TrendingDown size={14} />
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Purchases</p>
            </div>
            <h3 className="text-lg font-black text-slate-900">{formatCurrency(totalPurchaseValue || 0)}</h3>
          </div>
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                <ArrowUpRight size={14} />
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Inflow</p>
            </div>
            <h3 className="text-lg font-black text-slate-900">{formatCurrency(totalInflowValue || 0)}</h3>
          </div>
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
                <ArrowDownRight size={14} />
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Outflow</p>
            </div>
            <h3 className="text-lg font-black text-slate-900">{formatCurrency(totalOutflowValue || 0)}</h3>
          </div>
          <div className={cn(
            "p-4 rounded-3xl border shadow-sm",
            grossProfit >= 0 ? "bg-indigo-600 text-white border-indigo-700" : "bg-rose-600 text-white border-rose-700"
          )}>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-white/20 rounded-lg">
                <Scale size={14} />
              </div>
              <p className="text-[10px] font-bold opacity-80 uppercase tracking-wider">Net Profit/Loss</p>
            </div>
            <h3 className="text-lg font-black">{formatCurrency(grossProfit || 0)}</h3>
          </div>
        </div>

        {/* Charts Section */}
        <div className="space-y-6">
          {/* Daily Volume Chart */}
          <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-6 flex items-center gap-2">
              <BarChart3 size={16} className="text-indigo-600" /> Daily Volume (kg)
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyVolumeData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis fontSize={10} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="purchase" name="Purchase" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="sale" name="Sale" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Commodity Distribution */}
            <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-6 flex items-center gap-2">
                <PieChartIcon size={16} className="text-indigo-600" /> Commodity Mix
              </h3>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={commodityData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {commodityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {commodityData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-[10px] font-bold text-slate-500 uppercase">{entry.name}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Outflow Breakdown */}
            <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-6 flex items-center gap-2">
                <TrendingDown size={16} className="text-rose-600" /> Outflow Breakdown
              </h3>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={outflowCategoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {outflowCategoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {outflowCategoryData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-[10px] font-bold text-slate-500 uppercase truncate">{entry.name}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
