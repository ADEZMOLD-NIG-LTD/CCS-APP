import React, { useState } from 'react';
import { Megaphone, Send } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCommit } from '../hooks/useCommit';
import { newId } from '../lib/utils';
import { COMPANY_ROLES, ROLE_LABELS } from '../lib/permissions';
import { GLOBAL_NOTIFICATION_COMPANY_ID, type Company } from '../types';

interface BroadcastModuleProps {
  companies: Company[];
}

export default function BroadcastModule({ companies }: BroadcastModuleProps) {
  const { user } = useAuth();
  const { commit, busy } = useCommit();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'info' | 'alert' | 'update'>('info');
  const [targetRole, setTargetRole] = useState('ALL');
  const [targetCompany, setTargetCompany] = useState(GLOBAL_NOTIFICATION_COMPANY_ID);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim() || !message.trim()) return;
    const id = newId();
    const ok = await commit(
      [{
        kind: 'set',
        collection: 'notifications',
        id,
        data: {
          id,
          companyId: targetCompany,
          title: title.trim(),
          message: message.trim(),
          type,
          targetRole,
          createdAt: new Date().toISOString(),
          createdBy: user.uid,
          creatorName: 'CCS Platform',
        },
      }],
      { success: 'Announcement published.', context: 'notifications' }
    );
    if (ok) {
      setTitle('');
      setMessage('');
      setType('info');
      setTargetRole('ALL');
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
          <Megaphone size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Announcements</h2>
          <p className="text-sm text-slate-500">Publish a notice to every company or to one company.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Companies</label>
            <select value={targetCompany} onChange={e => setTargetCompany(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium">
              <option value={GLOBAL_NOTIFICATION_COMPANY_ID}>All companies</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Audience</label>
            <select value={targetRole} onChange={e => setTargetRole(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium">
              <option value="ALL">Everyone</option>
              {COMPANY_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]} only</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Type</label>
          <div className="grid grid-cols-3 gap-3">
            {(['info', 'update', 'alert'] as const).map(t => (
              <button key={t} type="button" onClick={() => setType(t)}
                className={`p-3 rounded-xl border text-xs font-bold uppercase ${type === t ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-500'}`}>
                {t === 'info' ? 'General' : t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Title</label>
          <input required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="e.g. Scheduled maintenance" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Message</label>
          <textarea required maxLength={2000} value={message} onChange={e => setMessage(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none h-32 resize-none" />
        </div>

        <button type="submit" disabled={busy || !title.trim() || !message.trim()} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
          <Send size={18} /> {busy ? 'Publishing…' : 'Publish announcement'}
        </button>
      </form>
    </div>
  );
}
