import React, { useState } from 'react';
import { Edit, History, Package, Trash2 } from 'lucide-react';
import type { BagTransaction, Supplier, Transaction, Warehouse } from '../../types';
import { moistureLossKg } from '../../lib/finance';
import { cn, formatCurrency, formatNumber } from '../../lib/utils';

interface TransactionListProps {
  activeTab: 'COMMODITIES' | 'PACKAGING';
  transactions: Transaction[];
  bagTransactions: BagTransaction[];
  suppliers: Supplier[];
  warehouses: Warehouse[];
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
}

const PAGE = 50;

export default function TransactionList({ activeTab, transactions, bagTransactions, suppliers, warehouses, canEdit, canDelete, onEdit, onDelete }: TransactionListProps) {
  const [visible, setVisible] = useState(PAGE);
  const warehouseName = (id?: string) => warehouses.find(w => w.id === id)?.name || 'Unassigned';
  const items = activeTab === 'COMMODITIES' ? transactions : bagTransactions;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
        <History size={16} /> {activeTab === 'COMMODITIES' ? 'Purchases' : 'Bag activity'}
      </h2>

      {items.length === 0 && (
        <div className="bg-white rounded-2xl p-8 border border-dashed border-slate-300 text-center">
          <Package className="mx-auto text-slate-200 mb-2" size={32} />
          <p className="text-xs text-slate-400">Nothing recorded yet</p>
        </div>
      )}

      {activeTab === 'COMMODITIES'
        ? transactions.slice(0, visible).map(tx => {
            const moisture = tx.deductions ? moistureLossKg(tx.deductions.moistureActual, tx.deductions.moistureBenchmark, tx.grossWeight) : 0;
            return (
              <div key={tx.id} className="google-card p-4">
                <div className="flex justify-between items-start mb-3 gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold bg-blue-50 text-[var(--accent)] px-2 py-0.5 rounded uppercase">{tx.commodity}</span>
                      <span className="text-[10px] font-bold bg-slate-100 text-[var(--text-secondary)] px-2 py-0.5 rounded uppercase">{warehouseName(tx.warehouseId)}</span>
                      <span className="text-[10px] text-[var(--text-secondary)]">{tx.date ? new Date(tx.date).toLocaleDateString() : 'N/A'}</span>
                      <span className="text-[10px] text-slate-400">{tx.referenceId}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-[var(--text-primary)] truncate">{suppliers.find(s => s.id === tx.supplierId)?.name || 'Unknown supplier'}</h3>
                      {canEdit && (
                        <button onClick={() => onEdit(tx)} className="p-1 text-slate-400 hover:text-[var(--accent)]" title="Adjust purchase" aria-label="Adjust purchase"><Edit size={14} /></button>
                      )}
                      {canDelete && (
                        <button onClick={() => onDelete(tx)} className="p-1 text-slate-400 hover:text-rose-600" title="Delete purchase" aria-label="Delete purchase"><Trash2 size={14} /></button>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-[var(--text-primary)]">{formatNumber(tx.netWeight || 0)} kg</p>
                    <p className="text-[10px] text-[var(--text-secondary)]">{tx.calculationMethod === 'MANUAL' ? 'Manual' : 'Net weight'}</p>
                    {tx.storeRecordId && <p className="text-[9px] font-bold text-indigo-600 mt-1">Store ID: {tx.storeRecordId}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-50 text-center">
                  <div>
                    <p className="text-[9px] text-[var(--text-secondary)] uppercase">Gross</p>
                    <p className="text-[11px] font-bold">{formatNumber(tx.grossWeight)}kg</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-[var(--text-secondary)] uppercase">Deductions</p>
                    <p className="text-[11px] font-bold text-rose-500">-{formatNumber(Math.max(0, tx.grossWeight - tx.netWeight))}kg</p>
                    {tx.deductions && (
                      <div className="mt-1 flex flex-wrap gap-1 text-[7px] font-bold uppercase justify-center text-[var(--text-secondary)]">
                        {moisture > 0 && <span>M: {formatNumber(moisture, 1)}kg</span>}
                        {tx.deductions.tareWeight > 0 && <span>T: {formatNumber(tx.deductions.tareWeight, 1)}kg</span>}
                        {tx.deductions.moldWeight > 0 && <span>Q: {formatNumber(tx.deductions.moldWeight, 1)}kg</span>}
                        {tx.deductions.otherDeduction > 0 && <span>O: {formatNumber(tx.deductions.otherDeduction, 1)}kg</span>}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-[9px] text-[var(--text-secondary)] uppercase">Value</p>
                    <p className="text-[11px] font-bold text-emerald-600">{formatCurrency(tx.totalValue || 0)}</p>
                  </div>
                </div>
              </div>
            );
          })
        : bagTransactions.slice(0, visible).map(tx => {
            const inbound = tx.type === 'STOCK_IN' || tx.type === 'RETURN';
            return (
              <div key={tx.id} className="google-card p-4 flex justify-between items-center gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded uppercase', inbound ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>{tx.type.replace('_', ' ')}</span>
                    <span className="text-[10px] font-bold bg-slate-100 text-[var(--text-secondary)] px-2 py-0.5 rounded uppercase">{tx.packagingType.replace('_', ' ')}</span>
                    <span className="text-[10px] text-[var(--text-secondary)]">{tx.date ? new Date(tx.date).toLocaleDateString() : 'N/A'}</span>
                  </div>
                  <h3 className="font-bold text-[var(--text-primary)] truncate">{tx.reference}</h3>
                  <p className="text-[10px] text-[var(--text-secondary)]">
                    {tx.type === 'TRANSFER' ? `${warehouseName(tx.sourceWarehouseId)} → ${warehouseName(tx.destinationWarehouseId)}` : warehouseName(tx.warehouseId)}
                    {tx.supplierId ? ` · ${suppliers.find(s => s.id === tx.supplierId)?.name ?? 'Supplier'}` : ''}
                  </p>
                </div>
                <p className={cn('text-lg font-bold shrink-0', inbound ? 'text-emerald-600' : 'text-amber-600')}>
                  {tx.type === 'TRANSFER' ? '⇄' : inbound ? '+' : '-'}{formatNumber(tx.quantity, 0)}
                </p>
              </div>
            );
          })}

      {items.length > visible && (
        <button onClick={() => setVisible(v => v + PAGE)} className="w-full py-3 text-xs font-bold text-[var(--accent)] bg-white border border-[var(--border)] rounded-xl">
          Show more ({items.length - visible} remaining)
        </button>
      )}
    </section>
  );
}
