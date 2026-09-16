/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { LogIn, LayoutDashboard, Package, Shield, ArrowRight, AlertCircle, CheckCircle2, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MIN_PASSWORD_LENGTH, useAuth } from '../contexts/AuthContext';
import { isFirebaseConfigured } from '../firebase';
import { SUPPORT_EMAIL } from '../constants/app';
import LegalModal from './LegalModal';

export default function LoginPage() {
  const {
    signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword, enterDemoMode,
    errorMessage, setErrorMessage, successMessage, setSuccessMessage,
  } = useAuth();

  const [view, setView] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [legalModal, setLegalModal] = useState<{ open: boolean; type: 'privacy' | 'terms' }>({ open: false, type: 'privacy' });

  const switchView = (next: typeof view) => {
    setView(next);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (view === 'signup' && password !== confirmPassword) {
      setErrorMessage('The passwords do not match.');
      return;
    }
    setIsSubmitting(true);
    try {
      if (view === 'login') await signInWithEmail(email, password);
      else if (view === 'signup') await signUpWithEmail(email, password, name);
      else await resetPassword(email);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col lg:flex-row overflow-hidden">
      <div className="lg:w-1/2 p-8 lg:p-16 flex flex-col justify-between relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 bg-[var(--accent)] rounded-xl flex items-center justify-center shadow-lg">
              <Package className="text-white" size={24} />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">Commodity Control System</span>
          </div>
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
            <h1 className="text-5xl lg:text-7xl font-bold text-white leading-[0.95] mb-8">
              PRECISION <br />
              <span className="text-blue-400">IN EVERY</span> <br />
              TRANSACTION.
            </h1>
            <p className="text-slate-400 text-lg max-w-md mb-12 leading-relaxed font-medium">
              Commodity trading, inventory and financial tracking for cocoa, cashew and palm kernel operations.
            </p>
          </motion.div>
        </div>
        <div className="relative z-10 mt-12 pt-12 border-t border-slate-800">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Adezmold Business Consulting</p>
        </div>
      </div>

      <div className="lg:w-1/2 flex items-center justify-center p-8 bg-[var(--bg-app)] overflow-y-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="w-full max-w-md space-y-8 py-12">
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-2 tracking-tight">
              {view === 'login' ? 'Welcome back' : view === 'signup' ? 'Create account' : 'Reset password'}
            </h2>
            <p className="text-[var(--text-secondary)] text-sm font-medium">
              {view === 'login'
                ? 'Sign in to access your company dashboard.'
                : view === 'signup'
                  ? 'Create an account, verify your email, then join or register your company.'
                  : 'Enter your email to receive a password reset link.'}
            </p>
          </div>

          <div className="space-y-6">
            <AnimatePresence>
              {errorMessage && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3" role="alert">
                  <AlertCircle className="text-rose-600 shrink-0 mt-0.5" size={18} />
                  <p className="text-xs font-bold text-rose-900 flex-1">{errorMessage}</p>
                </motion.div>
              )}
              {successMessage && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3" role="status">
                  <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={18} />
                  <p className="text-xs font-bold text-emerald-900 flex-1">{successMessage}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {!isFirebaseConfigured ? (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800 leading-relaxed">
                This build has no Firebase configuration, so sign-in is unavailable. You can still explore the training demo; data stays in this browser.
              </div>
            ) : (
              <>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {view === 'signup' && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-4 mb-1 block">Full name</label>
                      <div className="relative">
                        <User className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={18} />
                        <input type="text" required autoComplete="name" value={name} onChange={e => setName(e.target.value)}
                          className="w-full bg-white border border-[var(--border)] rounded-xl pl-12 pr-5 py-4 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] font-medium" placeholder="John Doe" />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-4 mb-1 block">Email address</label>
                    <div className="relative">
                      <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={18} />
                      <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}
                        className="w-full bg-white border border-[var(--border)] rounded-xl pl-12 pr-5 py-4 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] font-medium" placeholder="name@company.com" />
                    </div>
                  </div>

                  {view !== 'forgot' && (
                    <div className="space-y-1">
                      <div className="flex justify-between items-center ml-4 mr-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1 block">Password</label>
                        {view === 'login' && (
                          <button type="button" onClick={() => switchView('forgot')} className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent)]">
                            Forgot?
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={18} />
                        <input type={showPassword ? 'text' : 'password'} required
                          autoComplete={view === 'signup' ? 'new-password' : 'current-password'}
                          minLength={view === 'signup' ? MIN_PASSWORD_LENGTH : undefined}
                          value={password} onChange={e => setPassword(e.target.value)}
                          className="w-full bg-white border border-[var(--border)] rounded-xl pl-12 pr-12 py-4 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] font-medium" />
                        <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] p-1" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                      {view === 'signup' && (
                        <p className="text-[10px] text-[var(--text-secondary)] ml-4">At least {MIN_PASSWORD_LENGTH} characters, with letters and numbers.</p>
                      )}
                    </div>
                  )}

                  {view === 'signup' && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-4 mb-1 block">Confirm password</label>
                      <div className="relative">
                        <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={18} />
                        <input type={showPassword ? 'text' : 'password'} required autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                          className="w-full bg-white border border-[var(--border)] rounded-xl pl-12 pr-5 py-4 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] font-medium" />
                      </div>
                    </div>
                  )}

                  <button type="submit" disabled={isSubmitting}
                    className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white p-5 rounded-xl font-bold shadow-md flex items-center justify-center gap-4 active:scale-[0.98] transition-all group disabled:opacity-50">
                    {isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>{view === 'login' ? 'Sign in' : view === 'signup' ? 'Create account' : 'Send reset link'}</span>
                        <ArrowRight size={18} className="ml-auto opacity-0 group-hover:opacity-100 transition-all" />
                      </>
                    )}
                  </button>

                  <p className="text-xs text-center text-[var(--text-secondary)]">
                    {view === 'login' ? (
                      <>Don't have an account? <button type="button" onClick={() => switchView('signup')} className="text-[var(--accent)] font-bold hover:underline">Sign up</button></>
                    ) : (
                      <>Already have an account? <button type="button" onClick={() => switchView('login')} className="text-[var(--accent)] font-bold hover:underline">Sign in</button></>
                    )}
                  </p>
                </form>

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[var(--border)]" /></div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-[var(--bg-app)] px-4 text-[var(--text-secondary)] font-bold tracking-widest">Or</span>
                  </div>
                </div>
              </>
            )}

            <div className={`grid gap-4 ${isFirebaseConfigured ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {isFirebaseConfigured && (
                <button onClick={signInWithGoogle} className="p-5 rounded-xl font-bold shadow-sm flex items-center justify-center gap-3 active:scale-[0.98] bg-white border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)]">
                  <LogIn size={18} /> <span>Google</span>
                </button>
              )}
              <button onClick={enterDemoMode} className="p-5 rounded-xl font-bold shadow-sm flex items-center justify-center gap-3 active:scale-[0.98] bg-white border border-[var(--border)] hover:border-emerald-500 hover:text-emerald-600">
                <LayoutDashboard size={18} /> <span>Training demo</span>
              </button>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 bg-white rounded-xl border border-[var(--border)] shadow-sm">
            <div className="w-10 h-10 bg-blue-50 text-[var(--accent)] rounded-xl flex items-center justify-center shrink-0">
              <Shield size={20} />
            </div>
            <div>
              <h4 className="font-bold text-[var(--text-primary)] text-sm">Secure by design</h4>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">Verified accounts, role-based access enforced on the server, and a tamper-proof audit trail.</p>
            </div>
          </div>

          <div className="text-center pt-4">
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1">© {new Date().getFullYear()} Adezmold Business Consulting</p>
            <div className="flex justify-center gap-4 mb-2">
              <button onClick={() => setLegalModal({ open: true, type: 'privacy' })} className="text-[10px] font-bold text-[var(--accent)] hover:underline uppercase tracking-widest">Privacy Policy</button>
              <button onClick={() => setLegalModal({ open: true, type: 'terms' })} className="text-[10px] font-bold text-[var(--accent)] hover:underline uppercase tracking-widest">Terms of Use</button>
            </div>
            <p className="text-[10px] text-[var(--text-secondary)]">
              Need help? <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[var(--accent)] hover:underline">Contact support</a>
            </p>
          </div>

          <LegalModal isOpen={legalModal.open} onClose={() => setLegalModal({ ...legalModal, open: false })} type={legalModal.type} />
        </motion.div>
      </div>
    </div>
  );
}
