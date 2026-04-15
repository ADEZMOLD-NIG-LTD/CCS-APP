/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface BuyerFormProps {
  submitting: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}

export default function BuyerForm({
  submitting,
  onSubmit,
  onCancel
}: BuyerFormProps) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold">Add New Buyer</h2>
        <button onClick={onCancel} className="text-slate-400">Cancel</button>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Buyer Name</label>
          <input required name="name" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="e.g. Export Co." />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Phone</label>
          <input required name="phone" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="Phone number" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase mb-1">Location</label>
          <input required name="location" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="City/State" />
        </div>
        <button 
          type="submit" 
          disabled={submitting}
          className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting ? 'Saving...' : 'Save Buyer'}
        </button>
      </form>
    </div>
  );
}
