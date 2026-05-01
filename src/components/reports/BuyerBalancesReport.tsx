/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Buyer } from '../../types';
import { formatCurrency } from '../../lib/utils';

interface BuyerBalancesReportProps {
  totalBuyerDebit: number;
  totalBuyerCredit: number;
  debitBuyers: (Buyer & { balance: number })[];
  creditBuyers: (Buyer & { balance: number })[];
}

export default function BuyerBalancesReport({
  totalBuyerDebit,
  totalBuyerCredit,
  debitBuyers,
  creditBuyers
}: BuyerBalancesReportProps) {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-600 rounded-2xl p-4 text-white shadow-lg">
          <p className="text-[10px] font-bold uppercase opacity-60 mb-1">Total Debit (They Owe)</p>
          <h2 className="text-xl font-black">{formatCurrency(totalBuyerDebit)}</h2>
        </div>
        <div className="bg-emerald-600 rounded-2xl p-4 text-white shadow-lg">
          <p className="text-[10px] font-bold uppercase opacity-60 mb-1">Total Credit (We Owe)</p>
          <h2 className="text-xl font-black">{formatCurrency(totalBuyerCredit)}</h2>
        </div>
      </div>

      <section>
        <h3 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowUpRight size={14} /> Debit Balances (They Owe Us)
          </div>
          <span className="bg-blue-100 px-2 py-0.5 rounded text-[9px]">{debitBuyers.length} Customers</span>
        </h3>
        <div className="space-y-2">
          {debitBuyers.length === 0 ? (
            <p className="text-center py-8 text-slate-400 text-xs bg-white rounded-2xl border border-dashed border-slate-200">No debit balances</p>
          ) : (
            debitBuyers.map(b => (
              <div key={b.id} className="bg-white p-4 rounded-2xl border border-slate-200 flex justify-between items-center shadow-sm">
                <div>
                  <p className="font-bold text-slate-900">{b.name}</p>
                  <p className="text-[10px] text-slate-400 uppercase">{b.location}</p>
                </div>
                <p className="text-lg font-black text-blue-600">{formatCurrency(b.balance)}</p>
              </div>
            ))
          )}
        </div>
      </section>

      <section>
        <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowDownRight size={14} /> Credit Balances (We Owe Them)
          </div>
          <span className="bg-emerald-100 px-2 py-0.5 rounded text-[9px]">{creditBuyers.length} Customers</span>
        </h3>
        <div className="space-y-2">
          {creditBuyers.length === 0 ? (
            <p className="text-center py-8 text-slate-400 text-xs bg-white rounded-2xl border border-dashed border-slate-200">No credit balances</p>
          ) : (
            creditBuyers.map(b => (
              <div key={b.id} className="bg-white p-4 rounded-2xl border border-slate-200 flex justify-between items-center shadow-sm">
                <div>
                  <p className="font-bold text-slate-900">{b.name}</p>
                  <p className="text-[10px] text-slate-400 uppercase">{b.location}</p>
                </div>
                <p className="text-lg font-black text-emerald-600">{formatCurrency(Math.abs(b.balance))}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
