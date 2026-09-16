/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import {
  AlertCircle, ArrowDownRight, ArrowRightLeft, ArrowUpRight, ChevronLeft, ChevronRight, LayoutDashboard,
  ShoppingCart, TrendingDown, TrendingUp, Users, Wallet,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useActiveCollection } from '../contexts/CompanyDataContext';
import { buildCashMovements, computeSupplierBalance, summarizeCash } from '../lib/finance';
import { isoToLocalDate, todayLocal, toLocalDateString } from '../lib/dates';
import type { AppModuleKey, PermissionAction } from '../lib/permissions';
import { formatCurrency, roundTo } from '../lib/utils';

interface DashboardProps {
  onNavigate: (module: AppModuleKey) => void;
}

function shiftDay(day: string, offset: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return toLocalDateString(new Date(y, m - 1, d + offset));
}

function friendly(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

interface Activity {
  id: string;
  title: string;
  amount: number;
  sign: '+' | '-' | '';
  date: string;
  sortKey: number;
  icon: typeof Wallet;
  tone: string;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { can, isModuleEnabled } = useAuth();
  // The cash book is only meaningful when the company's plan includes the journal module.
  const canSeeCash = can('view_journal') && isModuleEnabled('journal');
  const transactions = useActiveCollection('transactions').data;
  const suppliers = useActiveCollection('suppliers').data;
  const payments = useActiveCollection('payments').data;
  const journal = useActiveCollection('journal').data;
  const [day, setDay] = useState(todayLocal());

  const movements = useMemo(() => buildCashMovements(journal, payments), [journal, payments]);

  const stats = useMemo(() => {
    const daily = transactions.filter(t => isoToLocalDate(t.date) === day);
    const sum = (type: string) => roundTo(daily.filter(t => t.type === type).reduce((s, t) => s + (t.totalValue || 0), 0), 2);
    const cash = summarizeCash(movements, { start: day, end: day });
    const payable = roundTo(suppliers.reduce((s, supplier) => s + Math.max(0, computeSupplierBalance(supplier, { transactions, payments, journal })), 0), 2);
    return {
      sales: roundTo(sum('SALE') - sum('SALES_RETURN'), 2),
      purchases: roundTo(sum('PURCHASE') - sum('PURCHASE_RETURN'), 2),
      inflow: cash.inflow,
      outflow: cash.outflow,
      payable,
    };
  }, [transactions, suppliers, payments, journal, movements, day]);

  const recent = useMemo(() => {
    const time = (doc: { postingDate?: string; date: string }) => new Date(doc.postingDate || doc.date).getTime() || 0;
    const items: Activity[] = transactions.map(t => {
      const label = { PURCHASE: 'Purchase', SALE: 'Sale', TRANSFER: 'Transfer', PURCHASE_RETURN: 'Purchase return', SALES_RETURN: 'Sales return' }[t.type];
      const moneyOut = t.type === 'PURCHASE' || t.type === 'SALES_RETURN';
      return {
        id: `t-${t.id}`,
        title: `${label}: ${t.commodity}${t.type === 'TRANSFER' ? ` (${t.netWeight}kg)` : ''}`,
        amount: t.type === 'TRANSFER' ? 0 : t.totalValue || 0,
        sign: t.type === 'TRANSFER' ? '' : moneyOut ? '-' : '+',
        date: t.date,
        sortKey: time(t),
        icon: t.type === 'TRANSFER' ? ArrowRightLeft : moneyOut ? ArrowDownRight : ArrowUpRight,
        tone: t.type === 'TRANSFER' ? 'bg-slate-100 text-slate-600' : moneyOut ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600',
      };
    });
    if (canSeeCash) {
      for (const m of movements) {
        items.push({
          id: `m-${m.source}-${m.id}`,
          title: m.source === 'SUPPLIER_PAYMENT' ? `Supplier payment (${m.channel.toLowerCase()})` : `${m.direction === 'IN' ? 'Inflow' : 'Outflow'}: ${m.category}`,
          amount: m.amount,
          sign: m.direction === 'IN' ? '+' : '-',
          date: m.date,
          sortKey: time(m),
          icon: m.source === 'SUPPLIER_PAYMENT' ? Wallet : m.direction === 'IN' ? ArrowUpRight : ArrowDownRight,
          tone: m.direction === 'IN' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600',
        });
      }
    }
    return items.sort((a, b) => b.sortKey - a.sortKey).slice(0, 6);
  }, [transactions, movements, canSeeCash]);

  const cards = [
    { label: 'Sales (net of returns)', value: stats.sales, icon: TrendingUp, tone: 'bg-blue-100 text-[var(--accent)]', show: true },
    { label: 'Purchases (net of returns)', value: stats.purchases, icon: TrendingDown, tone: 'bg-rose-100 text-rose-600', show: true },
    { label: 'Cash in', value: stats.inflow, icon: ArrowUpRight, tone: 'bg-emerald-100 text-emerald-600', show: canSeeCash },
    { label: 'Cash out', value: stats.outflow, icon: ArrowDownRight, tone: 'bg-amber-100 text-amber-600', show: canSeeCash },
  ].filter(c => c.show);

  const actions: { icon: typeof Wallet; label: string; tone: string; module: AppModuleKey; permission: PermissionAction }[] = [
    { icon: ShoppingCart, label: 'Buy', tone: 'bg-emerald-50 text-emerald-600', module: 'purchases', permission: 'create_trade' },
    { icon: TrendingUp, label: 'Sell', tone: 'bg-blue-50 text-blue-600', module: 'sales', permission: 'create_trade' },
    { icon: Wallet, label: 'Pay', tone: 'bg-amber-50 text-amber-600', module: 'suppliers', permission: 'record_supplier_payment' },
    { icon: Users, label: 'Suppliers', tone: 'bg-purple-50 text-purple-600', module: 'suppliers', permission: 'view_trade' },
  ];

  return (
    <div className="p-4 space-y-6 bg-[var(--bg-app)] min-h-full pb-24">
      <div className="google-card p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 w-10 h-10 rounded-xl flex items-center justify-center text-[var(--accent)]"><LayoutDashboard size={20} /></div>
          <div>
            <h1 className="text-lg font-bold text-[var(--text-primary)]">Daily report</h1>
            <p className="text-xs text-[var(--text-secondary)]">Sales, purchases and cash movement for the selected day</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setDay(d => shiftDay(d, -1))} className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50" aria-label="Previous day"><ChevronLeft size={16} /></button>
          <input type="date" value={day} max={todayLocal()} onChange={e => e.target.value && setDay(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold bg-white text-center" aria-label="Day" />
          <button onClick={() => setDay(d => (d < todayLocal() ? shiftDay(d, 1) : d))} disabled={day >= todayLocal()} className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40" aria-label="Next day"><ChevronRight size={16} /></button>
          <button onClick={() => setDay(todayLocal())} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-50">Today</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {cards.map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="google-card p-4">
            <div className={`${card.tone} w-8 h-8 rounded-lg flex items-center justify-center mb-3`}><card.icon size={18} /></div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-secondary)] mb-1">{card.label}</p>
            <p className="text-lg font-bold text-[var(--text-primary)]">{formatCurrency(card.value)}</p>
            <p className="text-[10px] text-[var(--text-secondary)] mt-1 font-medium">{friendly(day)}</p>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[var(--text-primary)] rounded-[var(--radius-lg)] p-6 text-white shadow-lg flex items-center justify-between overflow-hidden relative">
        <div className="relative z-10">
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">Total accounts payable</p>
          <h2 className="text-3xl font-bold">{formatCurrency(stats.payable)}</h2>
          <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1"><AlertCircle size={10} /> Sum of what is currently owed to suppliers (as of today)</p>
        </div>
        <Wallet className="absolute -right-4 -bottom-4 text-white/5 w-32 h-32" />
      </motion.div>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">Recent activity</h2>
        {recent.length === 0 && <p className="text-xs text-[var(--text-secondary)]">Nothing recorded yet.</p>}
        {recent.map((activity, i) => (
          <motion.div key={activity.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="google-card p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 ${activity.tone} rounded-xl flex items-center justify-center shrink-0`}><activity.icon size={20} /></div>
              <div className="min-w-0">
                <h3 className="font-bold text-[var(--text-primary)] truncate">{activity.title}</h3>
                <p className="text-xs text-[var(--text-secondary)]">{activity.date ? new Date(activity.date).toLocaleDateString() : 'N/A'}</p>
              </div>
            </div>
            {activity.sign && <p className="font-bold shrink-0">{activity.sign}{formatCurrency(activity.amount)}</p>}
          </motion.div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">Quick actions</h2>
        <div className="grid grid-cols-4 gap-4">
          {actions.filter(a => can(a.permission)).map(action => (
            <div key={action.label} className="flex flex-col items-center gap-2">
              <button onClick={() => onNavigate(action.module)} className={`${action.tone} w-12 h-12 rounded-xl flex items-center justify-center shadow-sm active:scale-95 border border-transparent hover:border-current`} aria-label={action.label}>
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
