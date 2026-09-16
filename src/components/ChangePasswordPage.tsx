/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Shield, Lock, ArrowRight, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';
import { MIN_PASSWORD_LENGTH, passwordProblem, useAuth } from '../contexts/AuthContext';

interface ChangePasswordPageProps {
  /** When shown voluntarily from settings instead of being enforced. */
  onDone?: () => void;
}

function PasswordField({ label, value, onChange, autoComplete }: { label: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-4 mb-1 block">{label}</label>
      <div className="relative">
        <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type={visible ? 'text' : 'password'}
          required
          autoComplete={autoComplete}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-12 py-4 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
        />
        <button
          type="button"
          onClick={() => setVisible(v => !v)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-600 p-1"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}

export default function ChangePasswordPage({ onDone }: ChangePasswordPageProps) {
  const { changePassword, logout, profile } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('Choose a password different from your current one.');
      return;
    }
    const problem = passwordProblem(newPassword);
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      setDone(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update password.');
    } finally {
      setSubmitting(false);
    }
  };

  const forced = !onDone;

  return (
    <div className={forced ? 'min-h-screen bg-slate-50 flex items-center justify-center p-6' : 'p-4 flex justify-center'}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200 p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield size={32} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">{forced ? 'Update your password' : 'Change password'}</h2>
          <p className="text-slate-500 text-sm leading-relaxed">
            {forced
              ? profile?.mustChangePassword
                ? 'An administrator has asked you to set a new password before continuing.'
                : 'Your password has expired. Set a new password to continue.'
              : `Use at least ${MIN_PASSWORD_LENGTH} characters with letters and numbers.`}
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3 mb-6" role="alert">
            <AlertCircle className="text-rose-600 shrink-0 mt-0.5" size={18} />
            <p className="text-xs font-bold text-rose-900">{error}</p>
          </div>
        )}
        {done && !forced && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3 mb-6" role="status">
            <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={18} />
            <p className="text-xs font-bold text-emerald-900">Password updated.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordField label="Current password" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
          <PasswordField label="New password" value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
          <PasswordField label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />

          <button
            type="submit"
            disabled={submitting || !currentPassword || !newPassword || !confirmPassword}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
          >
            {submitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <>Update password <ArrowRight size={18} /></>}
          </button>

          {forced && (
            <button type="button" onClick={logout} className="w-full text-slate-400 py-2 text-sm font-bold hover:text-slate-600">
              Sign out
            </button>
          )}
        </form>
      </motion.div>
    </div>
  );
}
