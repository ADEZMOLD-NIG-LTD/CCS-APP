import React, { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Calendar, Edit2, Receipt, Trash2 } from 'lucide-react';
import type { CashMovement } from '../../lib/finance';
import type { Buyer, Supplier, Warehouse } from '../../types';
import { cn, formatCurrency } from '../../lib/utils';

interface JournalListProps {
  movements: CashMovement[];
  suppliers: Supplier[];
  buyers: Buyer[];
  warehouses: Warehouse[];
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (movement: CashMovement) => void;
  onDelete: (movement: CashMovement) => void;
}

const PAGE = 50;
const LOCKED_SOURCES = new Set(['PAYROLL', 'PETTY_CASH']);

export default function JournalList({ movements, suppliers, buyers, warehouses, canEdit, canDelete, onEdit, onDelete }: JournalListProps) {
  const [visible, setVisible] = useState(PAGE);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cash book</h2>
        <span className="text-[10px] font-bold text-slate-400">{movements.length} records</span>
      </div>

      {movements.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-dashed border-slate-300 text-center">
          <Receipt className="mx-auto text-slate-200 mb-2" size={48} />
          <p className="text-sm text-slate-400">No entries for this filter</p>
        </div>
      ) : (
        movements.slice(0, visible).map(m => {
          const source = m.journal?.source;
          const managedElsewhere = !!source && LOCKED_SOURCES.has(source);
          const origin = source === 'PAYROLL' ? 'Payroll' : source === 'PETTY_CASH' ? 'Petty cash' : source === 'BUYER' ? 'Customer receipt' : null;
          return (
            <div key={`${m.source}-${m.id}`} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', m.direction === 'IN' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600')}>
                    {m.direction === 'IN' ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn('text-[8px] font-black px-1.5 py-0.5 rounded uppercase', m.direction === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}>{m.category.replace(/_/g, ' ')}</span>
                      <span className="text-[10px] text-slate-400 font-medium">{m.channel}</span>
                      {origin && <span className="text-[8px] font-black px-1.5 py-0.5 rounded uppercase bg-slate-100 text-slate-600">{origin}</span>}
                      {m.journal?.bankName && <span className="text-[8px] font-black px-1.5 py-0.5 rounded uppercase bg-indigo-100 text-indigo-700">{m.journal.bankName}</span>}
                    </div>
                    <h3 className="font-bold text-slate-900 mt-0.5 break-words">{m.description}</h3>
                    <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <Calendar size={10} /> {new Date(m.date).toLocaleDateString()} · {warehouses.find(w => w.id === m.warehouseId)?.name || 'Unassigned'}
                    </p>
                    {m.supplierId && <p className="text-[10px] font-bold text-slate-500 mt-1">Supplier: {suppliers.find(s => s.id === m.supplierId)?.name ?? 'Unknown'}</p>}
                    {m.buyerId && <p className="text-[10px] font-bold text-slate-500 mt-1">Buyer: {buyers.find(b => b.id === m.buyerId)?.name ?? 'Unknown'}</p>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={cn('text-lg font-black', m.direction === 'IN' ? 'text-emerald-600' : 'text-rose-600')}>{m.direction === 'IN' ? '+' : '-'}{formatCurrency(m.amount)}</p>
                  {managedElsewhere ? (
                    <p className="text-[9px] text-slate-400 mt-2">Managed in {origin?.toLowerCase()}</p>
                  ) : (
                    <div className="flex items-center gap-2 mt-2 justify-end">
                      {canEdit && <button onClick={() => onEdit(m)} className="text-[11px] font-bold text-indigo-600 flex items-center gap-1"><Edit2 size={11} /> Adjust</button>}
                      {canDelete && <button onClick={() => onDelete(m)} className="text-[11px] font-bold text-rose-600 flex items-center gap-1"><Trash2 size={11} /> Delete</button>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}

      {movements.length > visible && (
        <button onClick={() => setVisible(v => v + PAGE)} className="w-full py-3 text-xs font-bold text-indigo-600 bg-white border border-slate-200 rounded-xl">
          Show more ({movements.length - visible} remaining)
        </button>
      )}
    </div>
  );
}
