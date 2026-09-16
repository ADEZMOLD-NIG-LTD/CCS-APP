import React, { useState } from 'react';
import { KeyRound, LogOut, RotateCcw, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ROLE_LABELS } from '../lib/permissions';
import { ALL_SYSTEM_MODULES } from '../constants/modules';
import { SUPPORT_EMAIL } from '../constants/app';
import { resetDemoData } from '../mockFirebase';
import BillingPanel from './BillingPanel';
import ChangePasswordPage from './ChangePasswordPage';
import ConfirmModal from './ConfirmModal';
import LegalModal from './LegalModal';

export default function SettingsPanel() {
  const { profile, company, user, usesPasswordSignIn, isDemoMode, isSuperAdmin, role, logout, requestCompanyDeletion } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [confirmDeletion, setConfirmDeletion] = useState(false);
  const [legal, setLegal] = useState<{ open: boolean; type: 'privacy' | 'terms' }>({ open: false, type: 'privacy' });

  const displayName = profile?.displayName || user?.displayName || user?.email || 'User';
  const enabledModules = company?.enabledModules && company.enabledModules.length > 0
    ? ALL_SYSTEM_MODULES.filter(m => company.enabledModules!.includes(m.id))
    : ALL_SYSTEM_MODULES;

  return (
    <div className="p-4 sm:p-8 flex flex-col items-center gap-6">
      <ConfirmModal
        isOpen={confirmDeletion}
        title="Request company deletion"
        message="The platform administrator will be asked to close this company and remove its data. Your team keeps access until the request is processed."
        confirmText="Send request"
        onConfirm={() => requestCompanyDeletion()}
        onCancel={() => setConfirmDeletion(false)}
      />

      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm w-full max-w-md text-center">
        <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-xl">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <h2 className="text-xl font-bold text-slate-900">{displayName}</h2>
        <p className="text-sm text-slate-500 mb-2">{user?.email}</p>
        <div className="flex justify-center gap-2 mb-6">
          {role && <span className="px-3 py-1 bg-indigo-100 text-indigo-600 rounded-full text-[10px] font-bold uppercase">{ROLE_LABELS[role]}</span>}
          {isSuperAdmin && <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-[10px] font-bold uppercase">Platform admin</span>}
        </div>

        {company && (
          <div className="text-left bg-slate-50 rounded-2xl p-4 border border-slate-100 mb-6">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Company</p>
            <p className="font-bold text-slate-900">{company.name}</p>
            <p className="text-xs text-slate-500 mb-3">Plan: {company.subscriptionPlan || 'Full access'}</p>
            <div className="flex flex-wrap gap-1">
              {enabledModules.map(m => (
                <span key={m.id} className="text-[9px] font-bold bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded">{m.name}</span>
              ))}
            </div>
            {company.deletionRequestedAt && (
              <p className="text-[10px] text-rose-600 font-bold mt-3">Deletion requested on {new Date(company.deletionRequestedAt).toLocaleDateString()}</p>
            )}
          </div>
        )}

        <div className="space-y-3">
          {usesPasswordSignIn && (
            <button onClick={() => setShowPassword(v => !v)} className="w-full bg-slate-100 text-slate-700 py-3 rounded-2xl font-bold flex items-center justify-center gap-2">
              <KeyRound size={18} /> {showPassword ? 'Hide password form' : 'Change password'}
            </button>
          )}
          {isDemoMode && (
            <button
              onClick={() => {
                resetDemoData();
                window.location.reload();
              }}
              className="w-full bg-amber-50 text-amber-700 py-3 rounded-2xl font-bold flex items-center justify-center gap-2"
            >
              <RotateCcw size={18} /> Reset training data
            </button>
          )}
          {!isDemoMode && role === 'ADMIN' && company && !company.deletionRequestedAt && (
            <button onClick={() => setConfirmDeletion(true)} className="w-full bg-white border border-rose-200 text-rose-600 py-3 rounded-2xl font-bold flex items-center justify-center gap-2">
              <Trash2 size={18} /> Request company deletion
            </button>
          )}
          <button onClick={logout} className="w-full bg-rose-50 text-rose-600 py-4 rounded-2xl font-bold flex items-center justify-center gap-2">
            <LogOut size={20} /> {isDemoMode ? 'Exit demo' : 'Sign out'}
          </button>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">© {new Date().getFullYear()} Adezmold Business Consulting</p>
          <div className="flex justify-center gap-4 mb-2">
            <button onClick={() => setLegal({ open: true, type: 'privacy' })} className="text-[10px] font-bold text-indigo-600 hover:underline uppercase tracking-widest">Privacy Policy</button>
            <button onClick={() => setLegal({ open: true, type: 'terms' })} className="text-[10px] font-bold text-indigo-600 hover:underline uppercase tracking-widest">Terms of Use</button>
          </div>
          <p className="text-[10px] text-slate-400">
            Support: <a href={`mailto:${SUPPORT_EMAIL}`} className="text-indigo-600 hover:underline">{SUPPORT_EMAIL}</a>
          </p>
        </div>
      </div>

      {!isDemoMode && (company || isSuperAdmin) && (
        <div className="w-full max-w-3xl">
          <BillingPanel />
        </div>
      )}

      {showPassword && <ChangePasswordPage onDone={() => setShowPassword(false)} />}

      <LegalModal isOpen={legal.open} onClose={() => setLegal({ ...legal, open: false })} type={legal.type} />
    </div>
  );
}
