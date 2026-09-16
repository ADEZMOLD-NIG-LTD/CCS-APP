/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, BarChart3, Info, PieChart as PieChartIcon, Scale, TrendingDown, TrendingUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useActiveCollection } from '../contexts/CompanyDataContext';
import { buildCashMovements, estimateProfit, summarizeCash } from '../lib/finance';
import { daysAgoLocal, isoToLocalDate, todayLocal } from '../lib/dates';
import { cn, formatCurrency, roundTo } from '../lib/utils';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#0ea5e9', '#84cc16'];
type Range = '7D' | '30D' | '90D' | 'ALL';
const RANGE_DAYS: Record<Exclude<Range, 'ALL'>, number> = { '7D': 6, '30D': 29, '90D': 89 };

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof TrendingUp; tone: string }) {
  return (
    <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('p-1.5 rounded-lg', tone)}><Icon size={14} /></div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      </div>
      <h3 className="text-lg font-black text-slate-900">{formatCurrency(value)}</h3>
    </div>
  );
}

function Breakdown({ title, icon: Icon, data, money }: { title: string; icon: typeof TrendingUp; data: { name: string; value: number }[]; money: boolean }) {
  return (
    <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-6 flex items-center gap-2"><Icon size={16} className="text-indigo-600" /> {title}</h3>
      {data.length === 0 ? (
        <p className="text-xs text-slate-400 py-12 text-center">No data for this period.</p>
      ) : (
        <>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value">
                  {data.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value: unknown) => (money ? formatCurrency(Number(value)) : `${Number(value).toLocaleString()} kg`)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {data.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="text-[10px] font-bold text-slate-500 uppercase truncate">{entry.name}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export default function AnalyticsModule() {
  const transactions = useActiveCollection('transactions').data;
  const journal = useActiveCollection('journal').data;
  const payments = useActiveCollection('payments').data;
  const [range, setRange] = useState<Range>('30D');

  const period = useMemo(() => ({ start: range === 'ALL' ? undefined : daysAgoLocal(RANGE_DAYS[range]), end: todayLocal() }), [range]);
  const inPeriod = (iso: string) => {
    const day = isoToLocalDate(iso);
    return !!day && (!period.start || day >= period.start) && day <= period.end;
  };

  const profit = useMemo(() => estimateProfit(transactions, journal, period), [transactions, journal, period]);
  const movements = useMemo(() => buildCashMovements(journal, payments), [journal, payments]);
  const cash = useMemo(() => summarizeCash(movements, period), [movements, period]);

  const periodTx = useMemo(() => transactions.filter(t => inPeriod(t.date)), [transactions, period]);

  const commodityMix = useMemo(() => {
    const totals: Record<string, number> = {};
    periodTx.filter(t => t.type === 'PURCHASE').forEach(t => { totals[t.commodity] = (totals[t.commodity] || 0) + (t.netWeight || 0); });
    return Object.entries(totals).map(([name, value]) => ({ name, value: roundTo(value, 2) })).sort((a, b) => b.value - a.value);
  }, [periodTx]);

  const dailyVolume = useMemo(() => {
    const byDay: Record<string, { day: string; label: string; purchase: number; sale: number }> = {};
    for (const t of periodTx) {
      if (t.type !== 'PURCHASE' && t.type !== 'SALE') continue;
      const day = isoToLocalDate(t.date);
      if (!day) continue;
      const [y, m, d] = day.split('-').map(Number);
      byDay[day] = byDay[day] || { day, label: new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), purchase: 0, sale: 0 };
      byDay[day][t.type === 'PURCHASE' ? 'purchase' : 'sale'] += t.netWeight || 0;
    }
    return Object.values(byDay).sort((a, b) => a.day.localeCompare(b.day));
  }, [periodTx]);

  const outflowMix = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const m of movements) {
      if (m.direction !== 'OUT' || !inPeriod(m.date)) continue;
      totals[m.category] = (totals[m.category] || 0) + m.amount;
    }
    return Object.entries(totals).map(([name, value]) => ({ name, value: roundTo(value, 2) })).sort((a, b) => b.value - a.value);
  }, [movements, period]);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-slate-900">Analytics</h1>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {(['7D', '30D', '90D', 'ALL'] as const).map(r => (
              <button key={r} onClick={() => setRange(r)} className={cn('px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider', range === r ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500')}>{r}</button>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <Kpi label="Revenue (net sales)" value={profit.revenue} icon={TrendingUp} tone="bg-emerald-50 text-emerald-600" />
          <Kpi label="Cost of goods sold" value={profit.costOfGoodsSold} icon={TrendingDown} tone="bg-rose-50 text-rose-600" />
          <Kpi label="Purchases" value={profit.totalPurchases} icon={TrendingDown} tone="bg-slate-100 text-slate-600" />
          <Kpi label="Operating expenses" value={profit.operatingExpenses} icon={ArrowDownRight} tone="bg-amber-50 text-amber-600" />
          <Kpi label="Cash in" value={cash.inflow} icon={ArrowUpRight} tone="bg-emerald-50 text-emerald-600" />
          <Kpi label="Cash out" value={cash.outflow} icon={ArrowDownRight} tone="bg-rose-50 text-rose-600" />
          <div className={cn('p-4 rounded-3xl border shadow-sm text-white col-span-2 lg:col-span-3', profit.netProfit >= 0 ? 'bg-indigo-600 border-indigo-700' : 'bg-rose-600 border-rose-700')}>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-white/20 rounded-lg"><Scale size={14} /></div>
              <p className="text-[10px] font-bold opacity-80 uppercase tracking-wider">Estimated net profit</p>
            </div>
            <h3 className="text-2xl font-black">{formatCurrency(profit.netProfit)}</h3>
            <p className="text-[10px] opacity-80 mt-2 flex gap-1">
              <Info size={12} className="shrink-0" />
              Gross profit {formatCurrency(profit.grossProfit)} (sales less weighted-average purchase cost of kg sold) + other income {formatCurrency(profit.otherIncome)} − operating expenses. Capital, loans, advances, drawings and asset purchases are excluded. Cash movement is not profit.
            </p>
          </div>
        </div>

        <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-6 flex items-center gap-2"><BarChart3 size={16} className="text-indigo-600" /> Daily volume (kg)</h3>
          {dailyVolume.length === 0 ? (
            <p className="text-xs text-slate-400 py-12 text-center">No purchases or sales in this period.</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyVolume}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis fontSize={10} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="purchase" name="Purchase" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="sale" name="Sale" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Breakdown title="Commodity mix (purchased kg)" icon={PieChartIcon} data={commodityMix} money={false} />
          <Breakdown title="Cash outflow by category" icon={TrendingDown} data={outflowMix} money />
        </div>
      </main>
    </div>
  );
}
