import React from 'react';
import { Receipt, ArrowUpRight, ArrowDownRight, Calendar, Trash2, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { JournalEntry, Supplier, Buyer, Warehouse } from '../../types';

interface JournalListProps {
  filteredEntries: JournalEntry[];
  suppliers: Supplier[];
  buyers: Buyer[];
  warehouses: Warehouse[];
  isAdmin: boolean;
  onDeleteEntry: (id: string) => void;
}

export default function JournalList({
  filteredEntries,
  suppliers,
  buyers,
  warehouses,
  isAdmin,
  onDeleteEntry
}: JournalListProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Transaction History</h2>
        <span className="text-[10px] font-bold text-slate-400">{filteredEntries.length} Records</span>
      </div>
      
      {filteredEntries.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-dashed border-slate-300 text-center">
          <Receipt className="mx-auto text-slate-200 mb-2" size={48} />
          <p className="text-sm text-slate-400">No entries found</p>
        </div>
      ) : (
        filteredEntries.map(entry => (
          <div key={entry.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm group">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  entry.type === 'INFLOW' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                )}>
                  {entry.type === 'INFLOW' ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className={cn(
                      "text-[8px] font-black px-1.5 py-0.5 rounded uppercase",
                      entry.type === 'INFLOW' ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                    )}>
                      {entry.category}
                    </p>
                    {entry.bankName && (
                      <span className="text-[8px] font-black px-1.5 py-0.5 rounded uppercase bg-indigo-100 text-indigo-700">
                        {entry.bankName}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 font-medium">{entry.paymentMethod}</span>
                  </div>
                  <h3 className="font-bold text-slate-900 mt-0.5">{entry.description}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Calendar size={10} className="text-slate-300" />
                    <p className="text-[10px] text-slate-400">{new Date(entry.date).toLocaleDateString()}</p>
                    <span className="text-[10px] text-slate-300">•</span>
                    <p className="text-[10px] font-bold text-indigo-400 uppercase">
                      {warehouses.find(w => w.id === entry.warehouseId)?.name || 'Unknown Store'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className={cn(
                  "text-lg font-black",
                  entry.type === 'INFLOW' ? "text-emerald-600" : "text-rose-600"
                )}>
                  {entry.type === 'INFLOW' ? '+' : '-'}₦{(entry.amount || 0).toLocaleString()}
                </p>
                {isAdmin && (
                  <button 
                    onClick={() => onDeleteEntry(entry.id)}
                    className="text-slate-300 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
            {entry.supplierId && (
              <div className="mt-3 pt-3 border-t border-slate-50 flex items-center gap-2">
                <AlertCircle size={12} className="text-rose-500" />
                <p className="text-[10px] font-bold text-rose-600 uppercase">
                  Charged to: {suppliers.find(s => s.id === entry.supplierId)?.name}
                </p>
              </div>
            )}
            {entry.buyerId && (
              <div className="mt-3 pt-3 border-t border-slate-50 flex items-center gap-2">
                <AlertCircle size={12} className="text-emerald-500" />
                <p className="text-[10px] font-bold text-emerald-600 uppercase">
                  Received from: {buyers.find(b => b.id === entry.buyerId)?.name}
                </p>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
