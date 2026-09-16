/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import type { Buyer } from '../../types';
import { AuditAction, auditOp, type AuditActor } from '../../lib/audit';
import { newId, roundTo, toNumber } from '../../lib/utils';
import type { WriteOp } from '../../lib/writes';
import { DigitFormattedInput } from '../DigitFormattedInput';

export interface BuyerInput {
  name: string;
  phone: string;
  location: string;
  previousBalance: number;
}

/** Write operations for creating or updating a buyer, with its audit entry. */
export function buyerRecordOps(actor: AuditActor, input: BuyerInput, existing: Buyer | null): WriteOp[] {
  const id = existing?.id ?? newId();
  const nowIso = new Date().toISOString();
  const record = {
    ...(existing ?? {}),
    id,
    companyId: actor.companyId,
    name: input.name.trim(),
    phone: input.phone.trim(),
    location: input.location.trim(),
    previousBalance: roundTo(input.previousBalance, 2),
    createdAt: existing?.createdAt ?? nowIso,
    ...(existing ? { updatedAt: nowIso } : {}),
  };
  return [
    { kind: 'set', collection: 'buyers', id, data: record },
    auditOp(actor, { action: existing ? AuditAction.UPDATE : AuditAction.CREATE, module: 'Buyers', recordId: id, details: `${existing ? 'Updated' : 'Added'} buyer ${record.name}`, previousData: existing, newData: record }),
  ];
}

interface BuyerFormProps {
  editingBuyer: Buyer | null;
  submitting: boolean;
  onSubmit: (input: BuyerInput) => void;
  onCancel: () => void;
}

const field = 'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none';

export default function BuyerForm({ editingBuyer, submitting, onSubmit, onCancel }: BuyerFormProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    onSubmit({
      name: String(form.get('name') ?? ''),
      phone: String(form.get('phone') ?? ''),
      location: String(form.get('location') ?? ''),
      previousBalance: toNumber(form.get('previousBalance')),
    });
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
      <div className="flex items-center gap-2 mb-6">
        <button type="button" onClick={onCancel} className="text-slate-500 hover:text-slate-900" aria-label="Back"><ArrowLeft size={20} /></button>
        <h2 className="text-lg font-semibold">{editingBuyer ? 'Edit buyer' : 'Add buyer'}</h2>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="block text-xs font-medium text-slate-500 uppercase mb-1">Buyer name</span>
          <input required maxLength={200} name="name" defaultValue={editingBuyer?.name} className={field} />
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-xs font-medium text-slate-500 uppercase mb-1">Phone</span>
            <input required maxLength={30} type="tel" name="phone" defaultValue={editingBuyer?.phone} className={field} />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-500 uppercase mb-1">Location</span>
            <input required maxLength={120} name="location" defaultValue={editingBuyer?.location} className={field} />
          </label>
        </div>
        <label className="block">
          <span className="block text-xs font-medium text-slate-500 uppercase mb-1">Opening balance (₦)</span>
          <DigitFormattedInput name="previousBalance" allowNegative defaultValue={editingBuyer?.previousBalance} className={field} prefix="₦" />
          <span className="block text-[10px] text-slate-400 mt-1">Positive = they owe you. Negative = you owe them.</span>
        </label>
        <button type="submit" disabled={submitting} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg disabled:opacity-50">
          {submitting ? 'Saving…' : editingBuyer ? 'Update buyer' : 'Save buyer'}
        </button>
      </form>
    </div>
  );
}
