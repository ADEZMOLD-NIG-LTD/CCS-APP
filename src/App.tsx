/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { LayoutDashboard, Users, Package, ShoppingCart, Settings, Menu, TrendingUp, Receipt, BarChart3, FileText, LogOut, LogIn, UserPlus, Building2, Clock, Wifi, WifiOff, BookOpen } from 'lucide-react';
import Dashboard from './components/Dashboard';
import SupplierModule from './components/SupplierModule';
import BuyerModule from './components/BuyerModule';
import InventoryModule from './components/InventoryModule';
import SalesModule from './components/SalesModule';
import JournalModule from './components/JournalModule';
import StaffModule from './components/StaffModule';
import WarehouseModule from './components/WarehouseModule';
import StoreKeeperModule from './components/StoreKeeperModule';
import AnalyticsModule from './components/AnalyticsModule';
import ReportsModule from './components/ReportsModule';
import SuperAdminModule from './components/SuperAdminModule';
import TrainingModule from './components/TrainingModule';
import LoginPage from './components/LoginPage';
import ChangePasswordPage from './components/ChangePasswordPage';
import Toast from './components/Toast';
import LegalModal from './components/LegalModal';
import { motion, AnimatePresence } from 'motion/react';
import { AuthProvider, useAuth } from './contexts/AuthContext';

type Module = 'dashboard' | 'suppliers' | 'buyers' | 'inventory' | 'purchases' | 'sales' | 'journal' | 'staff' | 'warehouses' | 'analytics' | 'reports' | 'settings' | 'superadmin' | 'store' | 'training';

function AppContent() {
  const { 
    user, profile, company, loading, signIn, logout, registerCompany, 
    signInAsDemo, isAdmin, isAccount, isAuditor, isSuperAdmin, isDemoMode,
    mustChangePassword, can, isOnline,
    errorMessage, setErrorMessage, successMessage, setSuccessMessage
  } = useAuth();
  const [activeModule, setActiveModule] = useState<Module>('dashboard');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [showDemoIntro, setShowDemoIntro] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [legalModal, setLegalModal] = useState<{ open: boolean; type: 'privacy' | 'terms' }>({ open: false, type: 'privacy' });

  console.log('AppContent: State', { loading, user: user?.uid, isDemoMode, showDemoIntro, mustChangePassword });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mb-2">Connecting to secure database...</p>
        <div className="mt-8 p-4 bg-slate-100 rounded-2xl border border-slate-200 text-center max-w-xs">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">System Diagnostics</p>
          <div className="space-y-1">
            <p className="text-[10px] text-slate-500 font-mono">Project: <span className="text-indigo-600 font-bold">{import.meta.env.VITE_FIREBASE_PROJECT_ID || "gen-lang-client-0555602350"}</span></p>
            <p className="text-[10px] text-slate-500 font-mono">Database: <span className="text-indigo-600 font-bold">{import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || "ai-studio-086bebaa-d248-491f-a312-4b87527790a1"}</span></p>
            <p className="text-[10px] text-slate-500 font-mono">Mode: <span className="text-slate-900 font-bold">{import.meta.env.MODE}</span></p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onSignIn={signIn} onSignInAsDemo={signInAsDemo} />;
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
              disabled={!newCompanyName.trim() || loading}
              className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Create Account'
              )}
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

  if (mustChangePassword) {
    return <ChangePasswordPage />;
  }

  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Home' },
    { id: 'suppliers', icon: Users, label: 'Suppliers', hidden: !can('manage_suppliers') },
    { id: 'buyers', icon: UserPlus, label: 'Buyers', hidden: !can('manage_buyers') },
    { id: 'inventory', icon: Package, label: 'Stock', hidden: !can('manage_inventory') },
    { id: 'store', icon: Package, label: 'Store Records', hidden: !can('manage_store_records') },
    { id: 'warehouses', icon: Building2, label: 'Stores', hidden: !can('manage_warehouses') },
    { id: 'purchases', icon: ShoppingCart, label: 'Buy', hidden: !can('manage_inventory') },
    { id: 'sales', icon: TrendingUp, label: 'Sales', hidden: !can('manage_inventory') },
    { id: 'journal', icon: Receipt, label: 'Journal', hidden: !can('manage_journal') },
    { id: 'staff', icon: Users, label: 'Staff', hidden: !can('manage_staff') },
    { id: 'analytics', icon: BarChart3, label: 'Data', hidden: !can('view_analytics') },
    { id: 'reports', icon: FileText, label: 'Docs', hidden: !can('view_reports') },
    { id: 'training', icon: BookOpen, label: 'Training' },
    { id: 'superadmin', icon: Settings, label: 'Admin', hidden: !isSuperAdmin },
  ].filter(item => !item.hidden);

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

  if (user && profile?.companyId && !company && !isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">Loading company profile...</p>
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

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-app)] font-sans text-[var(--text-primary)] overflow-hidden">
      <AnimatePresence>
        {successMessage && (
          <Toast 
            message={successMessage} 
            type="success" 
            onClose={() => setSuccessMessage(null)} 
          />
        )}
        {errorMessage && (
          <Toast 
            message={errorMessage} 
            type="error" 
            onClose={() => setErrorMessage(null)} 
          />
        )}
      </AnimatePresence>

      {/* Global Header */}
      <header className="bg-white border-b border-[var(--border)] px-4 py-3 flex justify-between items-center z-50 shadow-sm shrink-0 relative">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className={`p-2 rounded-xl transition-all ${showMenu ? 'bg-blue-50 text-[var(--accent)]' : 'hover:bg-slate-100 text-[var(--text-secondary)]'}`}
          >
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveModule('dashboard')}>
            <div className="w-10 h-10 bg-[var(--accent)] rounded-xl flex items-center justify-center text-white shadow-md">
              <LayoutDashboard size={24} />
            </div>
            <div className="flex flex-col">
              <h1 className="text-sm font-bold text-[var(--text-primary)] tracking-tight leading-tight">
                {company?.name || 'CCS System'}
              </h1>
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${isDemoMode ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                  {isDemoMode ? 'Training Mode' : 'Live System'}
                </p>
                {!isOnline && (
                  <div className="flex items-center gap-1 ml-2 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
                    <WifiOff size={10} className="text-rose-500" />
                    <span className="text-[8px] font-black text-rose-600 uppercase">Offline</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div 
          onClick={() => { setActiveModule('settings'); setShowMenu(false); }}
          className="flex items-center gap-3 pl-3 border-l border-[var(--border)] cursor-pointer group"
        >
          <div className="text-right hidden sm:block">
            <p className="text-[11px] font-bold text-[var(--text-primary)] leading-none group-hover:text-[var(--accent)] transition-colors">{profile?.displayName}</p>
            <p className="text-[9px] font-medium text-[var(--text-secondary)] uppercase tracking-tighter mt-0.5">{profile?.role}</p>
          </div>
          <div className="w-9 h-9 bg-slate-100 text-[var(--text-secondary)] rounded-xl flex items-center justify-center font-bold text-xs border border-[var(--border)] group-hover:bg-blue-50 group-hover:text-[var(--accent)] group-hover:border-blue-100 transition-all">
            {profile?.displayName?.charAt(0)}
          </div>
        </div>

        {/* Dropdown Menu */}
        <AnimatePresence>
          {showMenu && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowMenu(false)}
                className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40"
              />
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                className="absolute top-full left-4 mt-2 w-64 bg-white rounded-3xl shadow-2xl border border-slate-200 z-50 overflow-hidden flex flex-col max-h-[calc(100vh-100px)]"
              >
                <div className="p-2 grid grid-cols-1 gap-1 overflow-y-auto flex-1 custom-scrollbar">
                  {navItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveModule(item.id as Module);
                        setShowMenu(false);
                      }}
                      className={`flex items-center gap-3 w-full p-3 rounded-xl transition-all ${
                        activeModule === item.id 
                          ? 'bg-blue-50 text-[var(--accent)]' 
                          : 'hover:bg-slate-50 text-[var(--text-secondary)]'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        activeModule === item.id ? 'bg-blue-100' : 'bg-slate-50'
                      }`}>
                        <item.icon size={20} />
                      </div>
                      <span className="text-sm font-medium">{item.label}</span>
                    </button>
                  ))}
                </div>
                <div className="p-2 border-t border-[var(--border)] bg-slate-50 shrink-0">
                  <button
                    onClick={() => {
                      setActiveModule('settings');
                      setShowMenu(false);
                    }}
                    className={`flex items-center gap-3 w-full p-3 rounded-xl transition-all ${
                      activeModule === 'settings' 
                        ? 'bg-blue-50 text-[var(--accent)]' 
                        : 'hover:bg-white text-[var(--text-secondary)]'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      activeModule === 'settings' ? 'bg-blue-100' : 'bg-white border border-[var(--border)]'
                    }`}>
                      <Settings size={20} />
                    </div>
                    <span className="text-sm font-medium">User Settings</span>
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
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
            {activeModule === 'store' && <StoreKeeperModule />}
            {activeModule === 'analytics' && <AnalyticsModule />}
            {activeModule === 'reports' && <ReportsModule />}
            {activeModule === 'training' && <TrainingModule />}
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
                    <div className="flex justify-center gap-4 mb-2">
                      <button 
                        onClick={() => setLegalModal({ open: true, type: 'privacy' })}
                        className="text-[10px] font-bold text-indigo-600 hover:underline uppercase tracking-widest"
                      >
                        Privacy Policy
                      </button>
                      <button 
                        onClick={() => setLegalModal({ open: true, type: 'terms' })}
                        className="text-[10px] font-bold text-indigo-600 hover:underline uppercase tracking-widest"
                      >
                        Terms of Use
                      </button>
                    </div>
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

      <LegalModal 
        isOpen={legalModal.open} 
        onClose={() => setLegalModal({ ...legalModal, open: false })} 
        type={legalModal.type} 
      />
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

