/**
 * Shared "adjust entry" dialog for supplier and buyer ledgers. Returns the corrected document;
 * the caller commits it (with stock guards and an audit log).
 */

import React, { useMemo, useState } from 'react';
import type { JournalEntry, Payment, Transaction } from '../../types';
import { computeNetWeight } from '../../lib/finance';
import { isoToLocalDate, localDateToIso, todayLocal } from '../../lib/dates';
import { formatCurrency, formatWeight, roundTo, roundWeight, toNumber, WEIGHT_DECIMALS } from '../../lib/utils';
import { DigitFormattedInput } from '../DigitFormattedInput';

export type AdjustTarget =
  | { kind: 'TRANSACTION'; doc: Transaction }
  | { kind: 'PAYMENT'; doc: Payment }
  | { kind: 'JOURNAL'; doc: JournalEntry };

interface LedgerAdjustModalProps {
  target: AdjustTarget;
  busy: boolean;
  onCancel: () => void;
  onSave: (updated: AdjustTarget) => void;
}

const field = 'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium';

export default function LedgerAdjustModal({ target, busy, onCancel, onSave }: LedgerAdjustModalProps) {
  const [date, setDate] = useState(isoToLocalDate(target.doc.date) || todayLocal());
  const [error, setError] = useState<string | null>(null);

  // Transaction state
  const tx = target.kind === 'TRANSACTION' ? target.doc : null;
  const isReturn = tx?.type === 'PURCHASE_RETURN' || tx?.type === 'SALES_RETURN';
  const manual = !!tx && (isReturn || tx.calculationMethod === 'MANUAL');
  const [gross, setGross] = useState(String(tx?.grossWeight ?? ''));
  const [bags, setBags] = useState(String(tx?.noOfBags ?? tx?.bags ?? ''));
  const [price, setPrice] = useState(String(tx?.pricePerKg ?? ''));
  const [net, setNet] = useState(String(tx?.netWeight ?? ''));
  const [total, setTotal] = useState(String(tx?.totalValue ?? ''));
  const [supplierPrice, setSupplierPrice] = useState(String(tx?.supplierPricePerKg ?? ''));
  const [moistureActual, setMoistureActual] = useState(String(tx?.deductions?.moistureActual ?? 0));
  const [moistureBenchmark, setMoistureBenchmark] = useState(String(tx?.deductions?.moistureBenchmark ?? 0));
  const [tare, setTare] = useState(String(tx?.deductions?.tareWeight ?? 0));
  const [mold, setMold] = useState(String(tx?.deductions?.moldWeight ?? 0));
  const [other, setOther] = useState(String(tx?.deductions?.otherDeduction ?? 0));
  const [notes, setNotes] = useState(tx?.notes ?? '');

  // Payment / journal state
  const money = target.kind !== 'TRANSACTION' ? target.doc : null;
  const [amount, setAmount] = useState(String(money?.amount ?? ''));
  const [description, setDescription] = useState((money?.description ?? '').replace(/^\[ADVANCE\]\s*/, ''));
  const [reference, setReference] = useState(money?.reference ?? '');
  const [method, setMethod] = useState(target.kind === 'PAYMENT' ? target.doc.method : target.kind === 'JOURNAL' ? target.doc.paymentMethod ?? 'CASH' : 'CASH');
  const [isAdvance, setIsAdvance] = useState(target.kind === 'PAYMENT' && target.doc.description.startsWith('[ADVANCE]'));
  const [category, setCategory] = useState(target.kind === 'JOURNAL' ? target.doc.category : '');

  const computed = useMemo(() => {
    if (!tx) return null;
    if (manual) {
      const n = toNumber(net);
      const t = isReturn ? roundTo(n * toNumber(price), 2) : toNumber(total);
      return { netWeight: roundWeight(n), totalValue: roundTo(t, 2) };
    }
    const result = computeNetWeight({ grossWeight: gross, moistureActual, moistureBenchmark, tareWeight: tare, moldWeight: mold, otherDeduction: other });
    return { netWeight: result.netWeight, totalValue: roundTo(result.netWeight * toNumber(price), 2) };
  }, [tx, manual, isReturn, net, total, price, gross, moistureActual, moistureBenchmark, tare, mold, other]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const dateIso = localDateToIso(date, target.doc.date);

    if (target.kind === 'TRANSACTION' && tx && computed) {
      const grossWeight = roundWeight(toNumber(gross));
      if (grossWeight <= 0) return setError('Gross weight must be greater than zero.');
      if (computed.netWeight <= 0) return setError('Net weight must be greater than zero.');
      if (computed.netWeight > grossWeight) return setError('Net weight cannot exceed gross weight.');
      if (computed.totalValue <= 0) return setError('Total value must be greater than zero.');
      const updated: Transaction = {
        ...tx,
        date: dateIso,
        grossWeight,
        netWeight: computed.netWeight,
        bags: Math.max(0, Math.round(toNumber(bags))),
        noOfBags: Math.max(0, Math.round(toNumber(bags))),
        pricePerKg: roundTo(toNumber(price), 2),
        totalValue: computed.totalValue,
        notes: notes.trim(),
        deductions: manual ? tx.deductions : {
          moistureActual: toNumber(moistureActual),
          moistureBenchmark: toNumber(moistureBenchmark),
          tareWeight: Math.max(0, toNumber(tare)),
          moldWeight: Math.max(0, toNumber(mold)),
          otherDeduction: Math.max(0, toNumber(other)),
        },
      };
      if (tx.isDirectDelivery && tx.type === 'SALE') {
        const sp = roundTo(toNumber(supplierPrice), 2);
        if (sp <= 0) return setError('Enter the price owed to the supplier.');
        updated.supplierPricePerKg = sp;
        updated.supplierCreditValue = roundTo(computed.netWeight * sp, 2);
      }
      return onSave({ kind: 'TRANSACTION', doc: updated });
    }

    const value = roundTo(toNumber(amount), 2);
    if (value <= 0) return setError('Amount must be greater than zero.');
    if (!description.trim()) return setError('Enter a description.');

    if (target.kind === 'PAYMENT') {
      return onSave({
        kind: 'PAYMENT',
        doc: { ...target.doc, date: dateIso, amount: value, method: method as Payment['method'], reference: reference.trim(), description: `${isAdvance ? '[ADVANCE] ' : ''}${description.trim()}` },
      });
    }
    if (target.kind === 'JOURNAL') {
      if (!category.trim()) return setError('Enter a category.');
      return onSave({
        kind: 'JOURNAL',
        doc: { ...target.doc, date: dateIso, amount: value, category: category.trim(), description: description.trim(), reference: reference.trim(), paymentMethod: method },
      });
    }
  };

  const numberInput = (label: string, value: string, set: (v: string) => void) => (
    <label className="block">
      <span className="block text-[9px] font-bold text-slate-400 uppercase mb-1">{label}</span>
      {/* step="any": a fixed step makes the browser reject valid readings like 0.2222. */}
      <input type="number" min="0" step="any" value={value} onChange={e => set(e.target.value)} className="w-full px-2 py-2 bg-white border border-slate-200 rounded-lg text-xs" />
    </label>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl my-auto" role="dialog" aria-label="Adjust entry">
        <h2 className="text-xl font-bold mb-1">Adjust entry</h2>
        <p className="text-xs text-slate-500 mb-5">The original values are kept in the audit log.</p>
        {error && <p className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl p-3" role="alert">{error}</p>}
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Date</span>
            <input type="date" required max={todayLocal()} value={date} onChange={e => setDate(e.target.value)} className={field} />
          </label>

          {target.kind === 'TRANSACTION' && computed && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Gross weight</span>
                  <DigitFormattedInput required value={gross} onChange={setGross} decimals={WEIGHT_DECIMALS} className={field} suffix="kg" />
                </label>
                <label className="block">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bags</span>
                  <DigitFormattedInput value={bags} onChange={setBags} decimals={0} className={field} />
                </label>
                <label className="block">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Price per kg</span>
                  <DigitFormattedInput required value={price} onChange={setPrice} className={field} prefix="₦" />
                </label>
                {manual && (
                  <label className="block">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Net weight</span>
                    <DigitFormattedInput required value={net} onChange={setNet} decimals={WEIGHT_DECIMALS} className={field} suffix="kg" />
                  </label>
                )}
                {manual && !isReturn && (
                  <label className="block col-span-2">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Total value</span>
                    <DigitFormattedInput required value={total} onChange={setTotal} className={field} prefix="₦" />
                  </label>
                )}
                {tx?.isDirectDelivery && tx.type === 'SALE' && (
                  <label className="block col-span-2">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Price owed to supplier per kg</span>
                    <DigitFormattedInput required value={supplierPrice} onChange={setSupplierPrice} className={field} prefix="₦" />
                  </label>
                )}
              </div>
              {!manual && (
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 grid grid-cols-3 gap-2">
                  {numberInput('Moisture %', moistureActual, setMoistureActual)}
                  {numberInput('Benchmark %', moistureBenchmark, setMoistureBenchmark)}
                  {numberInput('Tare kg', tare, setTare)}
                  {numberInput('Mould kg', mold, setMold)}
                  {numberInput('Other kg', other, setOther)}
                </div>
              )}
              <p className="text-xs text-slate-600 bg-slate-50 rounded-xl p-3 break-words">Net {formatWeight(computed.netWeight)}kg · Total {formatCurrency(computed.totalValue)}</p>
              <label className="block">
                <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Reason for adjustment</span>
                <input required maxLength={300} value={notes} onChange={e => setNotes(e.target.value)} className={field} />
              </label>
            </>
          )}

          {target.kind !== 'TRANSACTION' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Amount</span>
                  <DigitFormattedInput required value={amount} onChange={setAmount} className={field} prefix="₦" />
                </label>
                <label className="block">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Method</span>
                  <select value={method} onChange={e => setMethod(e.target.value)} className={field}>
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">Bank transfer</option>
                    <option value={target.kind === 'PAYMENT' ? 'CHECK' : 'CHEQUE'}>Cheque</option>
                  </select>
                </label>
              </div>
              {target.kind === 'JOURNAL' && (
                <label className="block">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Category</span>
                  <input required maxLength={100} value={category} onChange={e => setCategory(e.target.value)} className={field} />
                </label>
              )}
              <label className="block">
                <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Description</span>
                <input required maxLength={300} value={description} onChange={e => setDescription(e.target.value)} className={field} />
              </label>
              <label className="block">
                <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Reference</span>
                <input maxLength={100} value={reference} onChange={e => setReference(e.target.value)} className={field} />
              </label>
              {target.kind === 'PAYMENT' && (
                <label className="flex items-center gap-2 bg-emerald-50 p-3 rounded-xl border border-emerald-100 text-xs font-bold text-emerald-700">
                  <input type="checkbox" checked={isAdvance} onChange={e => setIsAdvance(e.target.checked)} className="w-4 h-4 accent-emerald-600" /> Advance payment
                </label>
              )}
            </>
          )}

          <div className="flex gap-3 mt-6">
            <button type="button" onClick={onCancel} className="flex-1 py-4 text-slate-500 font-bold">Cancel</button>
            <button type="submit" disabled={busy} className="flex-1 bg-emerald-600 text-white py-4 rounded-xl font-bold shadow-lg disabled:opacity-50">
              {busy ? 'Saving…' : 'Save adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
