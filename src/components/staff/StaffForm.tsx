/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import type { Staff, Warehouse } from '../../types';
import { COMPANY_ROLES, ROLE_LABELS, canAssignRole, type CompanyRole } from '../../lib/permissions';
import { normalizeEmail, toNumber } from '../../lib/utils';
import { DigitFormattedInput } from '../DigitFormattedInput';

export interface StaffFormValues {
  name: string;
  role: CompanyRole;
  phone: string;
  salary: number;
  allowances: number;
  annualRent: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
  applyPAYE: boolean;
  applyPension: boolean;
  email: string;
  assignedWarehouseId: string;
  grantAccess: boolean;
}

interface StaffFormProps {
  editingStaff: Staff | null;
  warehouses: Warehouse[];
  actorRole: CompanyRole | null;
  lockedWarehouseId: string | null;
  hasLogin: boolean;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (values: StaffFormValues) => void;
}

const inputClass = 'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500';

export default function StaffForm({ editingStaff, warehouses, actorRole, lockedWarehouseId, hasLogin, submitting, onCancel, onSubmit }: StaffFormProps) {
  const [grantAccess, setGrantAccess] = useState(!editingStaff);
  const assignableRoles = COMPANY_ROLES.filter(r => canAssignRole(actorRole, r) || r === editingStaff?.role);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    onSubmit({
      name: String(form.get('name') ?? ''),
      role: String(form.get('role') ?? 'STAFF') as CompanyRole,
      phone: String(form.get('phone') ?? ''),
      salary: toNumber(form.get('salary')),
      allowances: toNumber(form.get('allowances')),
      annualRent: toNumber(form.get('annualRent')),
      bankName: String(form.get('bankName') ?? ''),
      accountNumber: String(form.get('accountNumber') ?? ''),
      accountName: String(form.get('accountName') ?? ''),
      applyPAYE: form.get('applyPAYE') === 'on',
      applyPension: form.get('applyPension') === 'on',
      email: normalizeEmail(form.get('email')),
      assignedWarehouseId: lockedWarehouseId ?? String(form.get('warehouseId') ?? ''),
      grantAccess: !hasLogin && grantAccess,
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold">{editingStaff ? 'Edit staff member' : 'New staff member'}</h2>
        <button type="button" onClick={onCancel} className="text-slate-400">Cancel</button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Full name</span>
          <input required maxLength={200} name="name" defaultValue={editingStaff?.name} className={inputClass} />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Role</span>
            <select required name="role" defaultValue={editingStaff?.role || 'STAFF'} className={`${inputClass} font-medium`}>
              {assignableRoles.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Assigned warehouse</span>
            <select name="warehouseId" defaultValue={lockedWarehouseId ?? editingStaff?.assignedWarehouseId ?? ''} disabled={!!lockedWarehouseId} className={`${inputClass} font-medium disabled:opacity-50`}>
              <option value="">All warehouses</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Phone</span>
            <input required name="phone" type="tel" maxLength={30} defaultValue={editingStaff?.phone} className={inputClass} />
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Monthly basic salary (₦)</span>
            <DigitFormattedInput required name="salary" defaultValue={editingStaff?.salary} className={`${inputClass} font-bold`} prefix="₦" />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Monthly allowances (₦)</span>
            <DigitFormattedInput name="allowances" defaultValue={editingStaff?.allowances} className={`${inputClass} font-bold`} prefix="₦" />
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Annual rent paid (₦, for rent relief)</span>
            <DigitFormattedInput name="annualRent" defaultValue={editingStaff?.annualRent} className={`${inputClass} font-bold`} prefix="₦" />
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <input name="bankName" maxLength={100} defaultValue={editingStaff?.bankName} className={inputClass} placeholder="Bank name" aria-label="Bank name" />
          <input name="accountNumber" maxLength={20} inputMode="numeric" defaultValue={editingStaff?.accountNumber} className={inputClass} placeholder="Account number" aria-label="Account number" />
          <input name="accountName" maxLength={120} defaultValue={editingStaff?.accountName} className={inputClass} placeholder="Account name" aria-label="Account name" />
        </div>

        <div className="flex flex-wrap gap-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <label className="flex items-center gap-3 text-xs font-bold text-slate-700 cursor-pointer">
            <input type="checkbox" name="applyPAYE" defaultChecked={editingStaff ? editingStaff.applyPAYE !== false : true} className="w-5 h-5 rounded border-slate-300 text-indigo-600" />
            Apply PAYE tax
          </label>
          <label className="flex items-center gap-3 text-xs font-bold text-slate-700 cursor-pointer">
            <input type="checkbox" name="applyPension" defaultChecked={editingStaff ? editingStaff.applyPension !== false : true} className="w-5 h-5 rounded border-slate-300 text-indigo-600" />
            Apply employee pension (8%)
          </label>
        </div>

        <label className="block">
          <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Email (needed for a login)</span>
          <input name="email" type="email" maxLength={200} defaultValue={editingStaff?.email} className={inputClass} placeholder="staff@example.com" />
        </label>

        {hasLogin ? (
          <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl p-3">This person already has a login. Role and warehouse changes apply to their access immediately.</p>
        ) : (
          <label className="flex items-start gap-3 p-4 bg-indigo-50 rounded-xl border border-indigo-100 cursor-pointer">
            <input type="checkbox" checked={grantAccess} onChange={e => setGrantAccess(e.target.checked)} className="w-5 h-5 mt-0.5 rounded border-slate-300 text-indigo-600" />
            <span className="text-xs text-indigo-900">
              <strong>Give this person a login.</strong> They'll receive an email to set their own password, then join with the role above. No password is shared.
            </span>
          </label>
        )}

        <button type="submit" disabled={submitting} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold shadow-lg disabled:opacity-50">
          {submitting ? 'Saving…' : editingStaff ? 'Update staff' : 'Save staff'}
        </button>
      </form>
    </motion.div>
  );
}
