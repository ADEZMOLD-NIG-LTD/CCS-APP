/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { LayoutDashboard, Users, Package, ShoppingCart, Settings, Menu, TrendingUp, Receipt, BarChart3, FileText, LogOut, LogIn, UserPlus, Building2, Clock } from 'lucide-react';
import Dashboard from './components/Dashboard';
import SupplierModule from './components/SupplierModule';
import BuyerModule from './components/BuyerModule';
import InventoryModule from './components/InventoryModule';
import SalesModule from './components/SalesModule';
import JournalModule from './components/JournalModule';
import StaffModule from './components/StaffModule';
import WarehouseModule from './components/WarehouseModule';
import AnalyticsModule from './components/AnalyticsModule';
import ReportsModule from './components/ReportsModule';
import SuperAdminModule from './components/SuperAdminModule';
import LoginPage from './components/LoginPage';
import { motion, AnimatePresence } from 'motion/react';
import { AuthProvider, useAuth } from './contexts/AuthContext';

type Module = 'dashboard' | 'suppliers' | 'buyers' | 'inventory' | 'purchases' | 'sales' | 'journal' | 'staff' | 'warehouses' | 'analytics' | 'reports' | 'settings' | 'superadmin';

function AppContent() {
  const { user, profile, company, loading, signIn, logout, registerCompany, signInAsDemo, isAdmin, isAccount, isAuditor, isSuperAdmin, isDemoMode } = useAuth();
  const [activeModule, setActiveModule] = useState<Module>('dashboard');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [showDemoIntro, setShowDemoIntro] = useState(true);

  console.log('AppContent: State', { loading, user: user?.uid, isDemoMode, showDemoIntro });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">Initializing System...</p>
      </div>
    );
  }

  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Home' },
    { id: 'suppliers', icon: Users, label: 'Suppliers' },
    { id: 'buyers', icon: UserPlus, label: 'Buyers' },
    { id: 'inventory', icon: Package, label: 'Stock' },
    { id: 'warehouses', icon: Building2, label: 'Stores' },
    { id: 'purchases', icon: ShoppingCart, label: 'Buy' },
    { id: 'sales', icon: TrendingUp, label: 'Sales' },
    { id: 'journal', icon: Receipt, label: 'Journal', hidden: !isAccount },
    { id: 'staff', icon: Users, label: 'Staff', hidden: !isAdmin && !isAccount },
    { id: 'analytics', icon: BarChart3, label: 'Data', hidden: !isAdmin && !isAuditor },
    { id: 'reports', icon: FileText, label: 'Docs' },
    { id: 'superadmin', icon: Settings, label: 'Admin', hidden: !isSuperAdmin },
  ].filter(item => !item.hidden);

  if (!user) {
    return <LoginPage onSignIn={signIn} onSignInAsDemo={signInAsDemo} />;
  }

  if (user && isDemoMode && showDemoIntro) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-900 p-6 text-center text-white">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/10 backdrop-blur-xl p-8 rounded-3xl border border-white/20 shadow-2xl w-full max-w-md"
        >
          <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg rotate-3">
            <LayoutDashboard size={40} className="text-white -rotate-3" />
          </div>
          <h2 className="text-3xl font-black mb-4 tracking-tight">Training Mode</h2>
          <p className="text-slate-300 mb-8 leading-relaxed">
            Welcome to the CCS Training Demo. You are now in a secure, isolated environment where you can practice all system features without affecting real data.
          </p>
          
          <div className="space-y-4 mb-8 text-left">
            <div className="flex items-center gap-3 text-sm font-medium text-slate-200">
              <div className="w-6 h-6 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center text-xs">✓</div>
              Practice buying & selling
            </div>
            <div className="flex items-center gap-3 text-sm font-medium text-slate-200">
              <div className="w-6 h-6 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center text-xs">✓</div>
              Manage demo warehouses
            </div>
            <div className="flex items-center gap-3 text-sm font-medium text-slate-200">
              <div className="w-6 h-6 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center text-xs">✓</div>
              Generate training reports
            </div>
          </div>

          <button 
            onClick={() => setShowDemoIntro(false)}
            className="w-full bg-white text-slate-900 py-4 rounded-2xl font-bold shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            Start Training Session
          </button>
          
          <button 
            onClick={logout}
            className="w-full text-slate-400 py-4 text-sm font-bold hover:text-white transition-colors"
          >
            Exit Demo Mode
          </button>
        </motion.div>
      </div>
    );
  }

  if (user && company && !company.isApproved && !isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-6 text-center">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl w-full max-w-md">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Clock size={32} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Approval Pending</h2>
          <p className="text-slate-500 mb-8">Your company registration for <strong>{company.name}</strong> is awaiting approval from the Super Admin. You will have access once approved.</p>
          
          <button 
            onClick={logout}
            className="w-full bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold active:scale-95 transition-all"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (user && (!profile || !profile.companyId)) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-6 text-center">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl w-full max-w-md">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Building2 size={32} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Register Company</h2>
          <p className="text-slate-500 mb-8">Welcome! To get started, please register your company name.</p>
          
          <div className="space-y-4">
            <div className="text-left">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-4 mb-1 block">Company Name</label>
              <input 
                type="text"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                placeholder="e.g. CCS Enterprise"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
              />
            </div>
            
            <button 
              onClick={() => registerCompany(newCompanyName)}
              disabled={!newCompanyName.trim()}
              className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
            >
              Create Account
            </button>
            
            <button 
              onClick={logout}
              className="w-full text-slate-400 py-2 text-sm font-bold hover:text-slate-600 transition-colors"
            >
              Cancel & Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeModule}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {activeModule === 'dashboard' && <Dashboard onNavigate={setActiveModule} />}
            {activeModule === 'suppliers' && <SupplierModule />}
            {activeModule === 'buyers' && <BuyerModule />}
            {activeModule === 'inventory' && <InventoryModule />}
            {activeModule === 'purchases' && <InventoryModule />}
            {activeModule === 'sales' && <SalesModule />}
            { activeModule === 'journal' && <JournalModule /> }
            {activeModule === 'staff' && <StaffModule />}
            {activeModule === 'warehouses' && <WarehouseModule />}
            {activeModule === 'analytics' && <AnalyticsModule />}
            {activeModule === 'reports' && <ReportsModule />}
            {activeModule === 'superadmin' && <SuperAdminModule />}
            {activeModule === 'settings' && (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm w-full max-w-md">
                  <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-xl">
                    {profile?.displayName?.charAt(0)}
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">{profile?.displayName}</h2>
                  <p className="text-sm text-slate-500 mb-1">{profile?.email}</p>
                  <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-600 rounded-full text-[10px] font-bold uppercase mb-8">
                    {profile?.role}
                  </span>
                  
                  <div className="space-y-3">
                    <button 
                      onClick={logout}
                      className="w-full bg-rose-50 text-rose-600 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
                    >
                      <LogOut size={20} /> Sign Out
                    </button>
                  </div>

                  <div className="mt-12 pt-8 border-t border-slate-100 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      © 2025 Adezmold Business Consulting
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Support: <a href="mailto:adezmoldent@gmail.com" className="text-indigo-600 hover:underline">adezmoldent@gmail.com</a>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 py-2 flex justify-around items-center z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveModule(item.id as Module)}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-300 ${
              activeModule === item.id 
                ? 'text-indigo-600 bg-indigo-50 scale-110' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <item.icon size={20} strokeWidth={activeModule === item.id ? 2.5 : 2} />
            <span className={`text-[10px] font-bold uppercase tracking-tighter ${
              activeModule === item.id ? 'opacity-100' : 'opacity-60'
            }`}>
              {item.label}
            </span>
          </button>
        ))}
        <button
          onClick={() => setActiveModule('settings')}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-300 ${
            activeModule === 'settings' 
              ? 'text-indigo-600 bg-indigo-50 scale-110' 
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Settings size={20} strokeWidth={activeModule === 'settings' ? 2.5 : 2} />
          <span className={`text-[10px] font-bold uppercase tracking-tighter ${
            activeModule === 'settings' ? 'opacity-100' : 'opacity-60'
          }`}>
            User
          </span>
        </button>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

