import React from 'react';
import { Building2, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { Supplier, Buyer, Warehouse, UserProfile } from '../../types';
import { DigitFormattedInput } from '../DigitFormattedInput';

interface JournalFormProps {
  profile: UserProfile | null;
  entryType: 'INFLOW' | 'OUTFLOW';
  setEntryType: (type: 'INFLOW' | 'OUTFLOW') => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  inflowCategories: string[];
  outflowCategories: string[];
  warehouses: Warehouse[];
  suppliers: Supplier[];
  buyers: Buyer[];
  submitting: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}

export default function JournalForm({
  profile,
  entryType,
  setEntryType,
  selectedCategory,
  setSelectedCategory,
  inflowCategories,
  outflowCategories,
  warehouses,
  suppliers,
  buyers,
  submitting,
  onSubmit,
  onCancel
}: JournalFormProps) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold">New Journal Entry</h2>
        <button onClick={onCancel} className="text-slate-400">Cancel</button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Entry Type</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setEntryType('INFLOW')}
              className={cn(
                "py-3 rounded-xl text-xs font-bold border transition-all",
                entryType === 'INFLOW' 
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700 ring-2 ring-emerald-500" 
                  : "bg-slate-50 border-slate-200 text-slate-500"
              )}
            >
              CASH INFLOW
            </button>
            <button
              type="button"
              onClick={() => setEntryType('OUTFLOW')}
              className={cn(
                "py-3 rounded-xl text-xs font-bold border transition-all",
                entryType === 'OUTFLOW' 
                  ? "bg-rose-50 border-rose-200 text-rose-700 ring-2 ring-rose-500" 
                  : "bg-slate-50 border-slate-200 text-slate-500"
              )}
            >
              CASH OUTFLOW
            </button>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Category</label>
          <select 
            name="category" 
            required 
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
          >
            <option value="">Select Category</option>
            {(entryType === 'INFLOW' ? inflowCategories : outflowCategories).map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {entryType === 'INFLOW' && selectedCategory === 'SALES PROCEEDS' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100"
          >
            <label className="block text-[10px] font-bold text-indigo-600 uppercase mb-2 flex items-center gap-2">
              <Building2 size={12} /> Bank Name
            </label>
            <input 
              name="bankName" 
              className="w-full px-4 py-2 bg-white border border-indigo-200 rounded-lg outline-none text-sm" 
              placeholder="Enter Bank Name (e.g. First Bank, GTB, Zenith)"
            />
          </motion.div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Warehouse</label>
            <select 
              name="warehouseId" 
              required 
              defaultValue={profile?.assignedWarehouseId || ''}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm"
            >
              <option value="" disabled>Select Warehouse</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Transaction Date</label>
            <input
              name="transactionDate"
              type="date"
              required
              defaultValue={(() => {
                const d = new Date();
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
              })()}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Amount (₦)</label>
          <DigitFormattedInput 
            name="amount" 
            required 
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-lg" 
            placeholder="0.00" 
            prefix="₦"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Description</label>
          <input name="description" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="What is this for?" />
        </div>

        {entryType === 'OUTFLOW' && (
          <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100">
            <label className="block text-[10px] font-bold text-rose-600 uppercase mb-2 flex items-center gap-2">
              <Users size={12} /> Charge to Supplier? (Optional)
            </label>
            <select name="supplierId" className="w-full px-4 py-2 bg-white border border-rose-200 rounded-lg outline-none text-sm">
              <option value="">No - General Business Expense</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.location})</option>)}
            </select>
            <p className="text-[9px] text-rose-400 mt-2 italic">
              * If selected, this amount will be deducted from the supplier's ledger balance.
            </p>
          </div>
        )}

        {entryType === 'INFLOW' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
              <label className="block text-[10px] font-bold text-emerald-600 uppercase mb-2 flex items-center gap-2">
                <Users size={12} /> Link to Buyer/Customer? (Optional)
              </label>
              <select name="buyerId" className="w-full px-4 py-2 bg-white border border-emerald-200 rounded-lg outline-none text-sm">
                <option value="">No - General Income</option>
                {buyers.map(b => <option key={b.id} value={b.id}>{b.name} ({b.location})</option>)}
              </select>
              <p className="text-[9px] text-emerald-400 mt-2 italic">
                * If selected, this amount will be credited to the customer's ledger balance.
              </p>
            </div>

            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
              <label className="block text-[10px] font-bold text-emerald-600 uppercase mb-2 flex items-center gap-2">
                <Users size={12} /> Reversal/Refund from Supplier? (Optional)
              </label>
              <select name="supplierId" className="w-full px-4 py-2 bg-white border border-emerald-200 rounded-lg outline-none text-sm">
                <option value="">No - General Income</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.location})</option>)}
              </select>
              <p className="text-[9px] text-emerald-400 mt-2 italic">
                * If selected, this amount will be credited back/refunded to the supplier's ledger balance.
              </p>
            </div>
          </div>
        )}

        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Payment Method</label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center justify-center gap-2 p-3 border border-slate-200 rounded-xl cursor-pointer has-[:checked]:bg-slate-900 has-[:checked]:text-white transition-all">
              <input type="radio" name="paymentMethod" value="CASH" defaultChecked className="hidden" />
              <span className="text-xs font-bold">CASH</span>
            </label>
            <label className="flex items-center justify-center gap-2 p-3 border border-slate-200 rounded-xl cursor-pointer has-[:checked]:bg-slate-900 has-[:checked]:text-white transition-all">
              <input type="radio" name="paymentMethod" value="BANK_TRANSFER" className="hidden" />
              <span className="text-xs font-bold">TRANSFER</span>
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className={cn(
            "w-full text-white py-4 rounded-xl font-bold shadow-xl active:scale-[0.98] transition-all mt-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2",
            entryType === 'INFLOW' ? "bg-emerald-600" : "bg-rose-600"
          )}
        >
          {submitting ? 'Recording...' : `Record ${entryType === 'INFLOW' ? 'Inflow' : 'Outflow'}`}
        </button>
      </form>
    </div>
  );
}
