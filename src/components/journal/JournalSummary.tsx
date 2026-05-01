import React from 'react';
import { Wallet, DollarSign, Building2, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';

interface JournalSummaryProps {
  openingBalances: { cash: number; bank: number };
  closingBalances: { cash: number; bank: number };
  totalInflow: number;
  totalOutflow: number;
}

export default function JournalSummary({
  openingBalances,
  closingBalances,
  totalInflow,
  totalOutflow
}: JournalSummaryProps) {
  return (
    <div className="space-y-4">
      <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Harmonized Cash Position</p>
              <h2 className="text-3xl font-black">{formatCurrency(closingBalances.cash + closingBalances.bank)}</h2>
            </div>
            <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md">
              <Wallet className="text-indigo-400" size={24} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-2xl p-4 backdrop-blur-sm border border-white/10">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign size={12} className="text-emerald-400" />
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Cash-in-Hand</p>
              </div>
              <p className="text-lg font-black">{formatCurrency(closingBalances.cash)}</p>
              <div className="mt-2 pt-2 border-t border-white/5 flex justify-between items-center">
                <span className="text-[8px] text-slate-500 uppercase">Opening: {formatCurrency(openingBalances.cash)}</span>
              </div>
            </div>
            <div className="bg-white/5 rounded-2xl p-4 backdrop-blur-sm border border-white/10">
              <div className="flex items-center gap-2 mb-1">
                <Building2 size={12} className="text-blue-400" />
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Bank Balance</p>
              </div>
              <p className="text-lg font-black">{formatCurrency(closingBalances.bank)}</p>
              <div className="mt-2 pt-2 border-t border-white/5 flex justify-between items-center">
                <span className="text-[8px] text-slate-500 uppercase">Opening: {formatCurrency(openingBalances.bank)}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
      </div>

      {/* Period Performance */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Period Inflow</p>
          <div className="flex items-center gap-2">
            <TrendingUp size={14} className="text-emerald-500" />
            <span className="text-sm font-black text-slate-900">{formatCurrency(totalInflow)}</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Period Outflow</p>
          <div className="flex items-center gap-2">
            <TrendingDown size={14} className="text-rose-500" />
            <span className="text-sm font-black text-slate-900">{formatCurrency(totalOutflow)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
