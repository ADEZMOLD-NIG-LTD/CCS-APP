/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { Staff, Warehouse, Company } from '../../types';

interface StaffFormProps {
  editingStaff: Staff | null;
  warehouses: Warehouse[];
  profile: any;
  company: Company | null;
  isAdmin: boolean;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
}

export default function StaffForm({
  editingStaff,
  warehouses,
  profile,
  company,
  isAdmin,
  submitting,
  onCancel,
  onSubmit
}: StaffFormProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold">{editingStaff ? 'Edit Staff Member' : 'New Staff Member'}</h2>
        <button onClick={onCancel} className="text-slate-400">Cancel</button>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Full Name</label>
          <input 
            required 
            name="name" 
            defaultValue={editingStaff?.name}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" 
            placeholder="e.g. John Doe" 
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Role</label>
            <select 
              required 
              name="role" 
              defaultValue={editingStaff?.role || 'STAFF'}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium"
            >
              <option value="STAFF">Staff</option>
              <option value="STORE_KEEPER">Store Keeper</option>
              <option value="ACCOUNT">Account/Finance</option>
              <option value="MANAGER">Manager</option>
              <option value="AUDITOR">Auditor</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Assigned Warehouse</label>
            <select 
              name="warehouseId" 
              defaultValue={editingStaff?.assignedWarehouseId || profile?.assignedWarehouseId || ''}
              disabled={!!profile?.assignedWarehouseId && !isAdmin}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium disabled:opacity-50"
            >
              <option value="">All Warehouses</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Phone</label>
            <input 
              required 
              name="phone" 
              defaultValue={editingStaff?.phone}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" 
              placeholder="080..." 
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Monthly Basic Salary (₦)</label>
            <input 
              required 
              name="salary" 
              type="number" 
              defaultValue={editingStaff?.salary}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold" 
              placeholder="0.00" 
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Monthly Allowances (₦)</label>
            <input 
              name="allowances" 
              type="number" 
              defaultValue={editingStaff?.allowances}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold" 
              placeholder="0.00" 
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bank Name</label>
            <input 
              name="bankName" 
              defaultValue={editingStaff?.bankName}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" 
              placeholder="e.g. GTBank" 
            />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Account Number</label>
          <input 
            name="accountNumber" 
            defaultValue={editingStaff?.accountNumber}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" 
            placeholder="0123456789" 
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Email (Optional for Login)</label>
          <input 
            name="email" 
            type="email" 
            defaultValue={editingStaff?.email}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" 
            placeholder="staff@example.com" 
          />
        </div>
        {!editingStaff && (
          <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
            <input 
              type="checkbox" 
              id="createAccount" 
              name="createAccount" 
              className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="createAccount" className="text-xs font-bold text-indigo-900 cursor-pointer">
              Create Login Account (Default Password: Welcome@${company?.name?.replace(/\s+/g, '') || 'CCS'}2025)
            </label>
          </div>
        )}
        <button 
          type="submit" 
          disabled={submitting}
          className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting ? 'Saving...' : editingStaff ? 'Update Staff' : 'Save Staff'}
        </button>
      </form>
    </motion.div>
  );
}
