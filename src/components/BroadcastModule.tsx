import React, { useState } from 'react';
import { Megaphone, Send, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

export default function BroadcastModule() {
  const { profile } = useAuth();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'info' | 'alert' | 'update'>('info');
  const [targetRole, setTargetRole] = useState('ALL');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{success: boolean; message: string} | null>(null);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !message || !profile?.companyId) return;

    setIsSubmitting(true);
    setStatus(null);

    try {
      await addDoc(collection(db, 'notifications'), {
        companyId: profile.companyId,
        title,
        message,
        type,
        targetRole,
        createdAt: new Date().toISOString(),
        createdBy: profile.uid,
        creatorName: profile.displayName || 'System Admin',
        readBy: []
      });

      setTitle('');
      setMessage('');
      setType('info');
      setTargetRole('ALL');
      setStatus({ success: true, message: 'Broadcast sent successfully!' });
      
      setTimeout(() => setStatus(null), 3000);
    } catch (error: any) {
      console.error('Error sending broadcast:', error);
      setStatus({ success: false, message: error.message || 'Failed to send broadcast.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
            <Megaphone size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Push Notifications</h2>
            <p className="text-sm text-slate-500">Send system-wide announcements or policy updates to your staff.</p>
          </div>
        </div>

        {status && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-xl mb-6 flex items-center gap-3 ${status.success ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}
          >
            {status.success ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            <p className="text-sm font-bold">{status.message}</p>
          </motion.div>
        )}

        <form onSubmit={handleBroadcast} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Target Audience</label>
            <select 
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium"
            >
              <option value="ALL">Everyone</option>
              <option value="MANAGER">Managers Only</option>
              <option value="STAFF">General Staff Only</option>
              <option value="STORE_KEEPER">Store Keepers Only</option>
              <option value="ACCOUNT">Finance & Accounts Only</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Notification Type</label>
            <div className="grid grid-cols-3 gap-3">
              <label className={`p-3 rounded-xl border flex items-center justify-center gap-2 cursor-pointer transition-all ${type === 'info' ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                <input type="radio" name="type" value="info" checked={type === 'info'} onChange={() => setType('info')} className="sr-only" />
                <Info size={16} />
                <span className="font-bold text-xs uppercase">General</span>
              </label>
              <label className={`p-3 rounded-xl border flex items-center justify-center gap-2 cursor-pointer transition-all ${type === 'update' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                <input type="radio" name="type" value="update" checked={type === 'update'} onChange={() => setType('update')} className="sr-only" />
                <CheckCircle size={16} />
                <span className="font-bold text-xs uppercase">Update</span>
              </label>
              <label className={`p-3 rounded-xl border flex items-center justify-center gap-2 cursor-pointer transition-all ${type === 'alert' ? 'bg-rose-50 border-rose-200 text-rose-700 shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                <input type="radio" name="type" value="alert" checked={type === 'alert'} onChange={() => setType('alert')} className="sr-only" />
                <AlertCircle size={16} />
                <span className="font-bold text-xs uppercase">Alert</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Title</label>
            <input 
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
              placeholder="e.g., Important Security Update"
              maxLength={60}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Message</label>
            <textarea 
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none h-32 resize-none"
              placeholder="Enter the full notification message here..."
              maxLength={300}
            />
          </div>

          <button 
            type="submit"
            disabled={isSubmitting || !title || !message}
            className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={18} />
            {isSubmitting ? 'Sending...' : 'Push Notification'}
          </button>
        </form>
      </div>
    </div>
  );
}
