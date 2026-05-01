/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Supplier } from '../../types';
import { formatCurrency } from '../../lib/utils';

interface SupplierBalancesReportProps {
  totalCreditBalance: number;
  totalDebitBalance: number;
  creditSuppliers: (Supplier & { balance: number })[];
  debitSuppliers: (Supplier & { balance: number })[];
}

export default function SupplierBalancesReport({
  totalCreditBalance,
  totalDebitBalance,
  creditSuppliers,
  debitSuppliers
}: SupplierBalancesReportProps) {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-indigo-600 rounded-2xl p-4 text-white shadow-lg">
          <p className="text-[10px] font-bold uppercase opacity-60 mb-1">Total Credit (We Owe)</p>
          <h2 className="text-xl font-black">{formatCurrency(totalCreditBalance)}</h2>
        </div>
        <div className="bg-rose-600 rounded-2xl p-4 text-white shadow-lg">
          <p className="text-[10px] font-bold uppercase opacity-60 mb-1">Total Debit (They Owe)</p>
          <h2 className="text-xl font-black">{formatCurrency(totalDebitBalance)}</h2>
        </div>
      </div>

      <section>
        <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowUpRight size={14} /> Credit Balances (We Owe)
          </div>
          <span className="bg-indigo-100 px-2 py-0.5 rounded text-[9px]">{creditSuppliers.length} Suppliers</span>
        </h3>
        <div className="space-y-2">
          {creditSuppliers.length === 0 ? (
            <p className="text-center py-8 text-slate-400 text-xs bg-white rounded-2xl border border-dashed border-slate-200">No credit balances</p>
          ) : (
            creditSuppliers.map(s => (
              <div key={s.id} className="bg-white p-4 rounded-2xl border border-slate-200 flex justify-between items-center shadow-sm">
                <div>
                  <p className="font-bold text-slate-900">{s.name}</p>
                  <p className="text-[10px] text-slate-400 uppercase">{s.location}</p>
                </div>
                <p className="text-lg font-black text-indigo-600">{formatCurrency(s.balance)}</p>
              </div>
            ))
          )}
        </div>
      </section>

      <section>
        <h3 className="text-xs font-bold text-rose-600 uppercase tracking-widest mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowDownRight size={14} /> Debit Balances (They Owe Us)
          </div>
          <span className="bg-rose-100 px-2 py-0.5 rounded text-[9px]">{debitSuppliers.length} Suppliers</span>
        </h3>
        <div className="space-y-2">
          {debitSuppliers.length === 0 ? (
            <p className="text-center py-8 text-slate-400 text-xs bg-white rounded-2xl border border-dashed border-slate-200">No debit balances</p>
          ) : (
            debitSuppliers.map(s => (
              <div key={s.id} className="bg-white p-4 rounded-2xl border border-slate-200 flex justify-between items-center shadow-sm">
                <div>
                  <p className="font-bold text-slate-900">{s.name}</p>
                  <p className="text-[10px] text-slate-400 uppercase">{s.location}</p>
                </div>
                <p className="text-lg font-black text-rose-600">{formatCurrency(Math.abs(s.balance))}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
