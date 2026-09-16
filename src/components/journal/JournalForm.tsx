import React, { useState } from 'react';
import { Building2, Users } from 'lucide-react';
import type { Buyer, JournalEntry, Supplier, Warehouse } from '../../types';
import { isoToLocalDate, todayLocal } from '../../lib/dates';
import { cn, roundTo, toNumber } from '../../lib/utils';
import { DigitFormattedInput } from '../DigitFormattedInput';

export const INFLOW_CATEGORIES = ['CAPITAL', 'LOAN', 'SALES PROCEEDS', 'INVESTMENT', 'ADVANCE RECEIPT', 'RECOVERY OF ADVANCE', 'OTHER INCOME'];
export const OUTFLOW_CATEGORIES = [
  'TRANSPORT', 'LOADING/UNLOADING', 'WAREHOUSE RENT', 'STAFF SALARY', 'UTILITIES', 'MAINTENANCE', 'SUPPLIER CHARGEBACK',
  'OFFICE SUPPLIES', 'DRAWINGS', 'ADVANCE PAYMENT', 'ASSET PURCHASE', 'REPAIRS AND SERVICES', 'DIESEL AND PETROL',
  'OUTSTANDING PAYMENT', 'OUTSTANDING/ADVANCE', 'BANK CHARGES', 'LOAN REPAYMENT', 'OTHER EXPENSE',
];

export interface JournalFormValues {
  type: 'INFLOW' | 'OUTFLOW';
  category: string;
  amount: number;
  description: string;
  warehouseId: string;
  date: string;
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CHEQUE';
  bankName?: string;
  reference?: string;
  supplierId?: string;
  buyerId?: string;
}

interface JournalFormProps {
  initial?: JournalEntry | null;
  warehouses: Warehouse[];
  suppliers: Supplier[];
  buyers: Buyer[];
  defaultWarehouseId: string;
  submitting: boolean;
  onSubmit: (values: JournalFormValues) => void;
  onCancel: () => void;
}

const field = 'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm';

export default function JournalForm({ initial, warehouses, suppliers, buyers, defaultWarehouseId, submitting, onSubmit, onCancel }: JournalFormProps) {
  const [type, setType] = useState<'INFLOW' | 'OUTFLOW'>(initial?.type ?? 'OUTFLOW');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [amount, setAmount] = useState(String(initial?.amount ?? ''));
  const [description, setDescription] = useState(initial?.description ?? '');
  const [warehouseId, setWarehouseId] = useState(initial?.warehouseId ?? defaultWarehouseId);
  const [date, setDate] = useState(initial ? isoToLocalDate(initial.date) || todayLocal() : todayLocal());
  const [method, setMethod] = useState<JournalFormValues['paymentMethod']>((initial?.paymentMethod as JournalFormValues['paymentMethod']) ?? 'CASH');
  const [bankName, setBankName] = useState(initial?.bankName ?? '');
  const [reference, setReference] = useState(initial?.reference ?? '');
  const [link, setLink] = useState<'NONE' | 'SUPPLIER' | 'BUYER'>(initial?.supplierId ? 'SUPPLIER' : initial?.buyerId ? 'BUYER' : 'NONE');
  const [supplierId, setSupplierId] = useState(initial?.supplierId ?? '');
  const [buyerId, setBuyerId] = useState(initial?.buyerId ?? '');
  const [error, setError] = useState<string | null>(null);

  const categories = type === 'INFLOW' ? INFLOW_CATEGORIES : OUTFLOW_CATEGORIES;
  const categoryOptions = initial && !categories.includes(initial.category) && initial.type === type ? [initial.category, ...categories] : categories;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const value = roundTo(toNumber(amount), 2);
    if (!category) return setError('Choose a category.');
    if (value <= 0) return setError('Amount must be greater than zero.');
    if (!warehouseId) return setError('Select a warehouse.');
    if (!description.trim()) return setError('Enter a description.');
    if (link === 'SUPPLIER' && !supplierId) return setError('Select the supplier.');
    if (link === 'BUYER' && !buyerId) return setError('Select the buyer.');
    onSubmit({
      type,
      category,
      amount: value,
      description: description.trim(),
      warehouseId,
      date,
      paymentMethod: method,
      bankName: method === 'CASH' ? undefined : bankName.trim() || undefined,
      reference: reference.trim() || undefined,
      supplierId: link === 'SUPPLIER' ? supplierId : undefined,
      buyerId: link === 'BUYER' ? buyerId : undefined,
    });
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold">{initial ? 'Adjust journal entry' : 'New journal entry'}</h2>
        <button type="button" onClick={onCancel} className="text-slate-400">Cancel</button>
      </div>
      {error && <p className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl p-3" role="alert">{error}</p>}

      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {(['INFLOW', 'OUTFLOW'] as const).map(t => (
            <button key={t} type="button" onClick={() => { setType(t); setCategory(''); if (t === 'OUTFLOW' && link === 'BUYER') setLink('NONE'); }}
              className={cn('py-3 rounded-xl text-xs font-bold border', type === t ? (t === 'INFLOW' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 ring-2 ring-emerald-500' : 'bg-rose-50 border-rose-200 text-rose-700 ring-2 ring-rose-500') : 'bg-slate-50 border-slate-200 text-slate-500')}>
              {t === 'INFLOW' ? 'MONEY IN' : 'MONEY OUT'}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Category</span>
          <select required value={category} onChange={e => setCategory(e.target.value)} className={field}>
            <option value="">Select category</option>
            {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Warehouse</span>
            <select required value={warehouseId} onChange={e => setWarehouseId(e.target.value)} className={field}>
              <option value="" disabled>Select warehouse</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Date</span>
            <input type="date" required max={todayLocal()} value={date} onChange={e => setDate(e.target.value)} className={field} />
          </label>
        </div>

        <label className="block">
          <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Amount</span>
          <DigitFormattedInput required value={amount} onChange={setAmount} className={cn(field, 'font-bold text-lg')} prefix="₦" />
        </label>

        <label className="block">
          <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Description</span>
          <input required maxLength={300} value={description} onChange={e => setDescription(e.target.value)} className={field} placeholder="What is this for?" />
        </label>

        <div className="grid grid-cols-3 gap-2">
          {([['CASH', 'Cash'], ['BANK_TRANSFER', 'Transfer'], ['CHEQUE', 'Cheque']] as const).map(([value, label]) => (
            <button key={value} type="button" onClick={() => setMethod(value)} className={cn('p-3 border rounded-xl text-xs font-bold', method === value ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-600')}>
              {label}
            </button>
          ))}
        </div>

        {method !== 'CASH' && (
          <label className="block bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
            <span className="text-[10px] font-bold text-indigo-600 uppercase mb-2 flex items-center gap-2"><Building2 size={12} /> Bank</span>
            <input maxLength={100} value={bankName} onChange={e => setBankName(e.target.value)} className="w-full px-4 py-2 bg-white border border-indigo-200 rounded-lg text-sm" placeholder="e.g. GTBank" />
          </label>
        )}

        <input maxLength={100} value={reference} onChange={e => setReference(e.target.value)} className={field} placeholder="Reference (optional)" aria-label="Reference" />

        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
          <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2"><Users size={12} /> Link to an account (optional)</span>
          <select value={link} onChange={e => setLink(e.target.value as typeof link)} className={field}>
            <option value="NONE">General business entry</option>
            <option value="SUPPLIER">{type === 'OUTFLOW' ? 'Supplier — reduces what we owe them' : 'Supplier — refund, adds to what we owe them'}</option>
            {type === 'INFLOW' && <option value="BUYER">Buyer — payment received from them</option>}
          </select>
          {link === 'SUPPLIER' && (
            <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className={field} aria-label="Supplier">
              <option value="">Select supplier</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}{s.location ? ` (${s.location})` : ''}</option>)}
            </select>
          )}
          {link === 'BUYER' && (
            <select value={buyerId} onChange={e => setBuyerId(e.target.value)} className={field} aria-label="Buyer">
              <option value="">Select buyer</option>
              {buyers.map(b => <option key={b.id} value={b.id}>{b.name}{b.location ? ` (${b.location})` : ''}</option>)}
            </select>
          )}
        </div>

        <button type="submit" disabled={submitting} className={cn('w-full text-white py-4 rounded-xl font-bold shadow-xl disabled:opacity-50', type === 'INFLOW' ? 'bg-emerald-600' : 'bg-rose-600')}>
          {submitting ? 'Saving…' : initial ? 'Save changes' : `Record ${type === 'INFLOW' ? 'money in' : 'money out'}`}
        </button>
      </form>
    </div>
  );
}
