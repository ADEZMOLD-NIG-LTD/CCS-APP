/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { LogIn, LayoutDashboard, Package, Shield, BarChart3, Users, Building2, ArrowRight, AlertCircle, CheckCircle2, WifiOff, Mail, Lock, User, Eye, EyeOff, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { firebaseConfig } from '../firebase';
import LegalModal from './LegalModal';

interface LoginPageProps {
  onSignIn: () => void;
  onSignInAsDemo: () => void;
}

export default function LoginPage({ onSignIn, onSignInAsDemo }: LoginPageProps) {
  const { 
    isFirestoreConnected, connectionError, signInWithEmail, signUpWithEmail, 
    resetPassword, errorMessage, setErrorMessage, successMessage, setSuccessMessage 
  } = useAuth();
  
  const [view, setView] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [legalModal, setLegalModal] = useState<{ open: boolean; type: 'privacy' | 'terms' }>({ open: false, type: 'privacy' });

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    if (view === 'login') {
      await signInWithEmail(email, password);
    } else if (view === 'signup') {
      await signUpWithEmail(email, password, name);
    } else if (view === 'forgot') {
      await resetPassword(email);
    }
    setIsSubmitting(false);
  };

  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  return (
    <div className="min-h-screen bg-white flex flex-col lg:flex-row overflow-hidden">
      {/* Left Side - Hero / Branding */}
      <div className="lg:w-1/2 bg-[var(--text-primary)] p-8 lg:p-16 flex flex-col justify-between relative overflow-hidden">
        {/* Abstract Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500 rounded-full blur-[120px]" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 bg-[var(--accent)] rounded-xl flex items-center justify-center shadow-lg">
              <Package className="text-white" size={24} />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">Commodity Control System</span>
          </div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl lg:text-7xl font-bold text-white leading-[0.95] mb-8">
              PRECISION <br />
              <span className="text-blue-400">IN EVERY</span> <br />
              TRANSACTION.
            </h1>
            <p className="text-slate-400 text-lg max-w-md mb-12 leading-relaxed font-medium">
              The ultimate ERP solution for commodity trading, inventory management, and financial tracking. Built for scale, designed for simplicity.
            </p>
          </motion.div>

          <div className="grid grid-cols-2 gap-8 max-w-md">
            <div className="space-y-2">
              <div className="text-blue-400 font-bold text-2xl">100%</div>
              <p className="text-slate-500 text-xs uppercase tracking-widest font-bold">Accuracy</p>
            </div>
            <div className="space-y-2">
              <div className="text-emerald-400 font-bold text-2xl">Real-time</div>
              <p className="text-slate-500 text-xs uppercase tracking-widest font-bold">Analytics</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-12 pt-12 border-t border-slate-800">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">
            Trusted by leading commodity firms across West Africa.
          </p>
        </div>
      </div>

      {/* Right Side - Login Options */}
      <div className="lg:w-1/2 flex items-center justify-center p-8 bg-[var(--bg-app)] overflow-y-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="w-full max-w-md space-y-8 py-12"
        >
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-2 tracking-tight">
              {view === 'login' ? 'Welcome Back' : view === 'signup' ? 'Create Account' : 'Reset Password'}
            </h2>
            <p className="text-[var(--text-secondary)] text-sm font-medium">
              {view === 'login' 
                ? 'Sign in to access your company dashboard and manage your operations.' 
                : view === 'signup' 
                ? 'Register your account to start managing your commodity business.' 
                : 'Enter your email to receive a password reset link.'}
            </p>
          </div>

          <div className="space-y-6">
            <AnimatePresence>
              {errorMessage && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3 overflow-hidden"
                >
                  <AlertCircle className="text-rose-600 shrink-0 mt-0.5" size={18} />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-rose-900">{errorMessage}</p>
                    <button 
                      onClick={() => setErrorMessage(null)}
                      className="text-[10px] font-bold uppercase tracking-widest text-rose-600 hover:text-rose-800 mt-1"
                    >
                      Dismiss
                    </button>
                  </div>
                </motion.div>
              )}
              {successMessage && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3 overflow-hidden"
                >
                  <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={18} />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-emerald-900">{successMessage}</p>
                    <button 
                      onClick={() => setSuccessMessage(null)}
                      className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 hover:text-emerald-800 mt-1"
                    >
                      Dismiss
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!isFirestoreConnected && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                <div className="text-amber-600 shrink-0 mt-0.5">
                  <WifiOff size={18} />
                </div>
                <div>
                  <p className="text-sm font-bold text-amber-900">System Offline</p>
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-amber-700 leading-relaxed">
                      {connectionError || "Connecting to secure database... Please wait."}
                    </p>
                    <button 
                      onClick={() => window.location.reload()}
                      className="text-[10px] font-bold uppercase tracking-widest text-amber-600 hover:text-amber-800 transition-colors text-left"
                    >
                      Tap to retry connection
                    </button>
                    <div className="flex flex-col gap-1 mt-1">
                      {firebaseConfig.firestoreDatabaseId !== '(default)' && (
                        <button 
                          onClick={() => {
                            const url = new URL(window.location.href);
                            url.searchParams.set('forceDefaultDb', 'true');
                            window.location.href = url.toString();
                          }}
                          className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 hover:text-indigo-800 transition-colors text-left"
                        >
                          Try (default) database instead
                        </button>
                      )}
                      <button 
                        onClick={() => {
                          const url = new URL(window.location.href);
                          url.searchParams.set('forceDefaultAuth', 'true');
                          window.location.href = url.toString();
                        }}
                        className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-colors text-left"
                      >
                        Trouble staying logged in? Try default auth
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Email/Password Form */}
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              {view === 'signup' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-4 mb-1 block">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={18} />
                    <input 
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-white border border-[var(--border)] rounded-xl pl-12 pr-5 py-4 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all font-medium"
                      placeholder="John Doe"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-4 mb-1 block">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={18} />
                  <input 
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white border border-[var(--border)] rounded-xl pl-12 pr-5 py-4 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all font-medium"
                    placeholder="name@company.com"
                  />
                </div>
              </div>

              {view === 'forgot' && (
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 mb-4">
                  <h4 className="text-[10px] font-black text-blue-900 uppercase tracking-widest mb-1 flex items-center gap-1">
                    <AlertCircle size={10} /> Alternative Method
                  </h4>
                  <p className="text-[11px] text-blue-700 leading-normal">
                    If you do not receive the email, please contact your <b>Warehouse Manager</b> or <b>System Administrator</b>. They can manually trigger a password reset for your account in the Staff module.
                  </p>
                </div>
              )}

              {view !== 'forgot' && (
                <div className="space-y-1">
                  <div className="flex justify-between items-center ml-4 mr-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1 block">Password</label>
                    {view === 'login' && (
                      <button 
                        type="button"
                        onClick={() => setView('forgot')}
                        className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent)] hover:text-[var(--accent-hover)]"
                      >
                        Forgot?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={18} />
                    <input 
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-white border border-[var(--border)] rounded-xl pl-12 pr-12 py-4 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all font-medium"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={togglePasswordVisibility}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors p-1"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              )}

              <button 
                type="submit"
                disabled={!isFirestoreConnected || isSubmitting}
                className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white p-5 rounded-xl font-bold shadow-md flex items-center justify-center gap-4 active:scale-[0.98] transition-all group disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>{view === 'login' ? 'Sign In' : view === 'signup' ? 'Create Account' : 'Send Reset Link'}</span>
                    <ArrowRight size={18} className="ml-auto opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </>
                )}
              </button>

              <div className="text-center">
                {view === 'login' ? (
                  <p className="text-xs text-[var(--text-secondary)]">
                    Don't have an account? <button type="button" onClick={() => setView('signup')} className="text-[var(--accent)] font-bold hover:underline">Sign Up</button>
                  </p>
                ) : (
                  <p className="text-xs text-[var(--text-secondary)]">
                    Already have an account? <button type="button" onClick={() => setView('login')} className="text-[var(--accent)] font-bold hover:underline">Sign In</button>
                  </p>
                )}
              </div>
            </form>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--border)]"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[var(--bg-app)] px-4 text-[var(--text-secondary)] font-bold tracking-widest">Or continue with</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={onSignIn}
                disabled={!isFirestoreConnected}
                className={`p-5 rounded-xl font-bold shadow-sm flex items-center justify-center gap-3 active:scale-[0.98] transition-all group bg-white border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50`}
              >
                <LogIn size={18} />
                <span>Google</span>
              </button>

              <button 
                onClick={onSignInAsDemo}
                disabled={!isFirestoreConnected}
                className={`p-5 rounded-xl font-bold shadow-sm flex items-center justify-center gap-3 active:scale-[0.98] transition-all group bg-white border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50`}
              >
                <LayoutDashboard size={18} />
                <span>Demo</span>
              </button>
            </div>

            <div className="text-center">
              <p className="text-[10px] text-[var(--text-secondary)] font-medium">
                Trouble with Google Sign-In? Try 
                <button 
                  onClick={() => window.open(window.location.href, '_blank')}
                  className="mx-1 text-[var(--accent)] font-bold hover:underline"
                >
                  opening in a new tab
                </button>
              </p>
            </div>
          </div>

          {/* Feature Highlights */}
          <div className="grid grid-cols-1 gap-4 pt-8">
            <div className="flex items-start gap-4 p-4 bg-white rounded-xl border border-[var(--border)] shadow-sm">
              <div className="w-10 h-10 bg-blue-50 text-[var(--accent)] rounded-xl flex items-center justify-center shrink-0">
                <Shield size={20} />
              </div>
              <div>
                <h4 className="font-bold text-[var(--text-primary)] text-sm uppercase tracking-tight">Secure & Compliant</h4>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">Enterprise-grade security with password expiration and role-based access control.</p>
              </div>
            </div>
          </div>

          <div className="text-center pt-8">
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1">
              © 2025 Adezmold Business Consulting
            </p>
            <div className="flex justify-center gap-4 mb-2">
              <button 
                onClick={() => setLegalModal({ open: true, type: 'privacy' })}
                className="text-[10px] font-bold text-[var(--accent)] hover:underline uppercase tracking-widest"
              >
                Privacy Policy
              </button>
              <button 
                onClick={() => setLegalModal({ open: true, type: 'terms' })}
                className="text-[10px] font-bold text-[var(--accent)] hover:underline uppercase tracking-widest"
              >
                Terms of Use
              </button>
            </div>
            <p className="text-[10px] text-[var(--text-secondary)]">
              Need help? <a href="mailto:adezmoldent@gmail.com" className="text-[var(--accent)] hover:underline">Contact Support</a>
            </p>
          </div>

          <LegalModal 
            isOpen={legalModal.open} 
            onClose={() => setLegalModal({ ...legalModal, open: false })} 
            type={legalModal.type} 
          />
        </motion.div>
      </div>
    </div>
  );
}

