/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { LogIn, LayoutDashboard, Package, Shield, BarChart3, Users, Building2, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginPageProps {
  onSignIn: () => void;
  onSignInAsDemo: () => void;
}

export default function LoginPage({ onSignIn, onSignInAsDemo }: LoginPageProps) {
  console.log('LoginPage: Rendered');
  return (
    <div className="min-h-screen bg-white flex flex-col lg:flex-row overflow-hidden">
      {/* Left Side - Hero / Branding */}
      <div className="lg:w-1/2 bg-slate-900 p-8 lg:p-16 flex flex-col justify-between relative overflow-hidden">
        {/* Abstract Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500 rounded-full blur-[120px]" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg rotate-3">
              <Package className="text-white -rotate-3" size={24} />
            </div>
            <span className="text-xl font-black text-white tracking-tight">Commodity Control System</span>
          </div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl lg:text-7xl font-black text-white leading-[0.9] mb-8">
              PRECISION <br />
              <span className="text-indigo-400">IN EVERY</span> <br />
              TRANSACTION.
            </h1>
            <p className="text-slate-400 text-lg max-w-md mb-12 leading-relaxed">
              The ultimate ERP solution for commodity trading, inventory management, and financial tracking. Built for scale, designed for simplicity.
            </p>
          </motion.div>

          <div className="grid grid-cols-2 gap-8 max-w-md">
            <div className="space-y-2">
              <div className="text-indigo-400 font-bold text-2xl">100%</div>
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
      <div className="lg:w-1/2 flex items-center justify-center p-8 bg-slate-50">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="w-full max-w-md space-y-8"
        >
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-black text-slate-900 mb-2">Welcome Back</h2>
            <p className="text-slate-500">Sign in to access your company dashboard and manage your operations.</p>
          </div>

          <div className="space-y-4">
            <button 
              onClick={onSignIn}
              className="w-full bg-slate-900 text-white p-5 rounded-2xl font-bold shadow-xl flex items-center justify-center gap-4 hover:bg-slate-800 active:scale-[0.98] transition-all group"
            >
              <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center group-hover:bg-white/20 transition-colors">
                <LogIn size={18} />
              </div>
              <span>Sign in with Google</span>
              <ArrowRight size={18} className="ml-auto opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </button>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-50 px-4 text-slate-400 font-bold tracking-widest">Or try the system</span>
              </div>
            </div>

            <button 
              onClick={onSignInAsDemo}
              className="w-full bg-white text-slate-900 border-2 border-slate-200 p-5 rounded-2xl font-bold shadow-sm flex items-center justify-center gap-4 hover:border-indigo-500 hover:text-indigo-600 active:scale-[0.98] transition-all group"
            >
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-50 transition-colors">
                <LayoutDashboard size={18} />
              </div>
              <span>Training Demo Mode</span>
              <ArrowRight size={18} className="ml-auto opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </button>
          </div>

          {/* Feature Highlights */}
          <div className="grid grid-cols-1 gap-4 pt-8">
            <div className="flex items-start gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                <Shield size={20} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Secure & Compliant</h4>
                <p className="text-xs text-slate-500 leading-relaxed">Enterprise-grade security with role-based access control for your staff.</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                <BarChart3 size={20} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Advanced Analytics</h4>
                <p className="text-xs text-slate-500 leading-relaxed">Gain insights into your inventory, sales, and supplier performance instantly.</p>
              </div>
            </div>
          </div>

          <div className="text-center pt-8">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
              © 2025 Adezmold Business Consulting
            </p>
            <p className="text-[10px] text-slate-400">
              Need help? <a href="mailto:adezmoldent@gmail.com" className="text-indigo-600 hover:underline">Contact Support</a>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
