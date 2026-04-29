/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Shield, Lock, ArrowRight, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';

export default function ChangePasswordPage() {
  const { changePassword, logout, errorMessage, successMessage } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      // In AuthContext we have setErrorMessage, but it's easier to show a local one here first
      return;
    }
    
    if (newPassword === currentPassword) {
      alert("New password must be different from the current password.");
      return;
    }

    setIsSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      // AuthContext will update mustChangePassword, triggering redirect in App.tsx
    } catch (err) {
      // Error handled by AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200 p-8"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Shield size={32} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight uppercase">Security Update</h2>
          <p className="text-slate-500 text-sm leading-relaxed">
            Your password has expired or needs to be updated for security reasons. Please set a new password to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-4 mb-1 block">Current Password</label>
            <div className="relative">
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type={showCurrentPassword ? "text" : "password"}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-12 py-4 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all font-medium"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-600 transition-colors p-1"
              >
                {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-4 mb-1 block">New Password</label>
            <div className="relative">
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type={showNewPassword ? "text" : "password"}
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-12 py-4 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all font-medium"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-600 transition-colors p-1"
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-4 mb-1 block">Confirm New Password</label>
            <div className="relative">
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type={showConfirmPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full bg-slate-50 border rounded-2xl pl-12 pr-12 py-4 focus:outline-none focus:ring-2 transition-all font-medium ${
                  confirmPassword && newPassword !== confirmPassword 
                    ? 'border-rose-200 focus:ring-rose-500' 
                    : 'border-slate-200 focus:ring-amber-500'
                }`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-600 transition-colors p-1"
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-[10px] text-rose-500 font-bold ml-4 mt-1 uppercase tracking-widest">Passwords do not match</p>
            )}
          </div>

          <button 
            type="submit"
            disabled={isSubmitting || !newPassword || newPassword !== confirmPassword}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 mt-4"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>Update Password <ArrowRight size={18} /></>
            )}
          </button>

          <button 
            type="button"
            onClick={logout}
            className="w-full text-slate-400 py-2 text-sm font-bold hover:text-slate-600 transition-colors"
          >
            Sign Out
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Password expiration is a security policy to protect your account. <br />
            Reset links expire in 1 hour for your safety.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
