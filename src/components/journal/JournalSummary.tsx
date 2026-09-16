import React from 'react';
import { Building2, DollarSign, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';

interface JournalSummaryProps {
  position: { cash: number; bank: number; other: number };
  period: { inflow: number; outflow: number; net: number };
  periodLabel: string;
}

export default function JournalSummary({ position, period, periodLabel }: JournalSummaryProps) {
  return (
    <div className="space-y-4">
      <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden">
        <div className="flex justify-between items-start mb-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Cash position (all time)</p>
            <h2 className="text-3xl font-black">{formatCurrency(position.cash + position.bank + position.other)}</h2>
          </div>
          <div className="bg-white/10 p-3 rounded-2xl"><Wallet className="text-indigo-400" size={24} /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <p className="text-[9px] font-bold uppercase text-slate-400 flex items-center gap-2"><DollarSign size={12} className="text-emerald-400" /> Cash in hand</p>
            <p className="text-lg font-black">{formatCurrency(position.cash)}</p>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <p className="text-[9px] font-bold uppercase text-slate-400 flex items-center gap-2"><Building2 size={12} className="text-blue-400" /> Bank</p>
            <p className="text-lg font-black">{formatCurrency(position.bank)}</p>
          </div>
        </div>
        {position.other !== 0 && <p className="text-[10px] text-slate-400 mt-3">Other channels: {formatCurrency(position.other)}</p>}
        <p className="text-[9px] text-slate-500 mt-3">Includes supplier payments and customer receipts. Charges and deductions on supplier/buyer accounts are excluded because they don't move cash.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">In · {periodLabel}</p>
          <span className="text-sm font-black text-slate-900 flex items-center gap-2"><TrendingUp size={14} className="text-emerald-500" />{formatCurrency(period.inflow)}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Out · {periodLabel}</p>
          <span className="text-sm font-black text-slate-900 flex items-center gap-2"><TrendingDown size={14} className="text-rose-500" />{formatCurrency(period.outflow)}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Net · {periodLabel}</p>
          <span className="text-sm font-black text-slate-900">{formatCurrency(period.net)}</span>
        </div>
      </div>
    </div>
  );
}
