/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { LayoutDashboard, Users, Package, ShoppingCart, Settings, Menu, TrendingUp, Receipt, BarChart3, FileText, LogOut, LogIn, UserPlus, Building2, Clock, Wifi, WifiOff, BookOpen, Wallet, Trash2, Lock, ShieldAlert } from 'lucide-react';
import Dashboard from './components/Dashboard';
import SupplierModule from './components/SupplierModule';
import BuyerModule from './components/BuyerModule';
import InventoryModule from './components/InventoryModule';
import SalesModule from './components/SalesModule';
import JournalModule from './components/JournalModule';
import PettyCashModule from './components/PettyCashModule';
import StaffModule from './components/StaffModule';
import WarehouseModule from './components/WarehouseModule';
import StoreKeeperModule from './components/StoreKeeperModule';
import AnalyticsModule from './components/AnalyticsModule';
import ReportsModule from './components/ReportsModule';
import SuperAdminModule from './components/SuperAdminModule';
import LoginPage from './components/LoginPage';
import ChangePasswordPage from './components/ChangePasswordPage';
import Toast from './components/Toast';
import LegalModal from './components/LegalModal';
import FirebaseSetupGuide from './components/FirebaseSetupGuide';
import NotificationsBell from './components/NotificationsBell';
import { motion, AnimatePresence } from 'motion/react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SubscriptionPlanType } from './constants/modules';
import { firebaseConfig } from './firebase';

type Module = 'dashboard' | 'suppliers' | 'buyers' | 'inventory' | 'purchases' | 'sales' | 'journal' | 'petty_cash' | 'staff' | 'warehouses' | 'analytics' | 'reports' | 'settings' | 'superadmin' | 'store';

function AppContent() {
  const { 
    user, profile, company, loading, signIn, logout, registerCompany, resetProfileCompany,
    connectExistingCompany, deleteCompanyByOwner, deleteUserAccount, userCompanies, approveCompany,
    signInAsDemo, isAdmin, isAccount, isAuditor, isSuperAdmin, isDemoMode,
    mustChangePassword, can, isModuleEnabled, isOnline, isFirestoreConnected, connectionError,
    errorMessage, setErrorMessage, successMessage, setSuccessMessage
  } = useAuth();
  const [activeModule, setActiveModule] = useState<Module>('dashboard');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyTier, setNewCompanyTier] = useState<SubscriptionPlanType>('ENTERPRISE');
  const [showDemoIntro, setShowDemoIntro] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [legalModal, setLegalModal] = useState<{ open: boolean; type: 'privacy' | 'terms' }>({ open: false, type: 'privacy' });

  console.log('AppContent: State', { loading, user: user?.uid, isDemoMode, showDemoIntro, mustChangePassword });

  React.useEffect(() => {
    if (user && company && !company.isApproved && !isSuperAdmin) {
      console.log('AppContent: Auto-approving company for logged in owner:', company.id);
      approveCompany(company.id);
    }
  }, [user, company?.id, company?.isApproved, isSuperAdmin, approveCompany]);

  // Strict check for Firebase configuration to avoid phantom initialization errors
  const isConfigured = !!firebaseConfig.apiKey && !!firebaseConfig.projectId;
  const bootError = (window as any).FIREBASE_CONFIG_ERROR || (window as any).FIREBASE_INIT_ERROR;

  // Render a safety screen if we've been loading too long or have a fatal boot error
  if (loading || bootError) {
    const isOfflineOrError = !isFirestoreConnected || !!connectionError;
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center">
        {isOfflineOrError ? (
          <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 mb-6 border border-amber-200 shadow-sm animate-pulse">
            <WifiOff size={32} />
          </div>
        ) : (
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
        )}
        
        <p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest mb-2">
          {bootError ? "System Configuration Error" : isOfflineOrError ? "Database Connection Issue" : "Connecting to secure database..."}
        </p>
        
        {isOfflineOrError && !bootError && (
          <div className="mt-4 p-6 bg-amber-50 rounded-2xl border border-amber-200 text-left max-w-md shadow-sm">
            <h2 className="text-amber-800 font-bold text-sm mb-2 flex items-center gap-2">
              <WifiOff size={16} /> Could not connect to the database
            </h2>
            <p className="text-amber-700 text-xs leading-relaxed bg-white/50 p-3 rounded-lg border border-amber-100 font-mono mb-6">
              {connectionError || "The database connection timed out or was refused. This can happen if you have network restrictions, if your Firebase project is not active, or if Firestore is pending setup."}
            </p>
            <div className="space-y-3">
              <button 
                onClick={() => window.location.reload()}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl text-xs transition-colors shadow-md active:scale-[0.98]"
              >
                Retry Connection
              </button>
              
              <button 
                onClick={signInAsDemo}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl text-xs transition-colors shadow-md active:scale-[0.98]"
              >
                Launch Offline Training Demo
              </button>
              
              <button 
                onClick={logout}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2 px-4 rounded-xl text-[10px] transition-colors active:scale-[0.98]"
              >
                Clear Session & Sign Out
              </button>
            </div>
          </div>
        )}

        {bootError && (
          <div className="mt-4 p-6 bg-rose-50 rounded-2xl border border-rose-200 text-left max-w-md shadow-sm">
            <h2 className="text-rose-800 font-bold text-sm mb-2 flex items-center gap-2">
              <WifiOff size={16} /> Boot sequence interrupted
            </h2>
            <p className="text-rose-600 text-xs font-mono leading-relaxed bg-white/50 p-3 rounded-lg border border-rose-100">
              {bootError}
            </p>
            <div className="mt-4 space-y-2">
              <p className="text-[10px] text-rose-500">
                1. Ensure GitHub Secrets (VITE_FIREBASE_*) are set in your repository.<br/>
                2. Check if the latest CI/CD pipeline run succeeded.<br/>
                3. Verify your Firebase project is active and Firestore is enabled.
              </p>
              <button 
                onClick={() => window.location.reload()}
                className="w-full mt-2 bg-rose-600 text-white text-[10px] font-bold py-2 rounded-xl hover:bg-rose-700 transition-colors"
              >
                RETRY BOOT
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 p-4 bg-slate-100 rounded-2xl border border-slate-200 text-center w-full max-w-xs shadow-inner">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">System Diagnostics</p>
          <div className="space-y-1">
            <p className="text-[10px] text-slate-500 font-mono">Project: <span className="text-indigo-600 font-bold truncate block">{import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId || "not set"}</span></p>
            <p className="text-[10px] text-slate-500 font-mono">Environment: <span className="text-indigo-600 font-bold uppercase">{import.meta.env.VITE_APP_ENV || (import.meta.env.PROD ? "production" : "development")}</span></p>
            <p className="text-[10px] text-slate-500 font-mono">DB Ver: <span className="text-indigo-600 font-bold">1.2.0-secure</span></p>
            <p className="text-[10px] text-slate-500 font-mono">Status: <span className={bootError ? "text-rose-600 font-bold" : isOfflineOrError ? "text-amber-600 font-bold" : "text-emerald-600 font-bold"}>{bootError ? "ERROR" : isOfflineOrError ? "CONNECTION_ISSUE" : "INITIALIZING"}</span></p>
          </div>
        </div>
      </div>
    );
  }

  if (!isConfigured) {
    return <FirebaseSetupGuide />;
  }

  if (!user) {
    return <LoginPage onSignIn={signIn} onSignInAsDemo={signInAsDemo} />;
  }

  const renderUserCompaniesList = () => {
    if (!userCompanies || userCompanies.length === 0) return null;
    return (
      <div className="mt-6 border-t border-slate-100 pt-6 text-left">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Your Registered Companies</h3>
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {userCompanies.map((c) => {
            const isCurrentlySelected = company?.id === c.id;
            return (
              <div 
                key={c.id} 
                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                  isCurrentlySelected 
                    ? 'bg-indigo-50/50 border-indigo-200 ring-2 ring-indigo-600/10' 
                    : 'bg-slate-50/50 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="min-w-0 pr-2">
                  <p className="font-bold text-sm text-slate-800 truncate">{c.name}</p>
                  <p className="text-[10px] text-slate-400 font-medium">ID: {c.id}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {c.isApproved ? (
                    <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      Approved
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                      Pending
                    </span>
                  )}
                  
                  {!isCurrentlySelected && (
                    <button
                      onClick={() => connectExistingCompany(c.id)}
                      className="text-[10px] font-black uppercase tracking-widest bg-white hover:bg-indigo-600 hover:text-white text-indigo-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-indigo-600 transition-all shadow-sm active:scale-95"
                    >
                      Connect
                    </button>
                  )}

                  <button
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete company "${c.name}"?`)) {
                        deleteCompanyByOwner(c.id);
                      }
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                    title="Delete company"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (user && (!profile || !profile.companyId) && !isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-6 text-center">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl w-full max-w-md">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Building2 size={32} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Register Company</h2>
          <p className="text-slate-500 mb-6 text-sm">Welcome! To get started, please register your company name or connect to your existing account.</p>

          {userCompanies && userCompanies.length > 0 && (
            <div className="mb-6 bg-indigo-50/80 border border-indigo-200 rounded-2xl p-4 text-left">
              <p className="text-xs font-bold text-indigo-900 mb-1">Found Existing Company!</p>
              <p className="text-xs text-indigo-700 mb-3">You are registered as owner of <strong>{userCompanies[0].name}</strong>.</p>
              <button 
                onClick={() => connectExistingCompany(userCompanies[0].id)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
              >
                Connect to {userCompanies[0].name} Now
              </button>
            </div>
          )}
          
          <div className="space-y-4">
            <div className="text-left">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-4 mb-1 block">Company Name</label>
              <input 
                type="text"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                placeholder="e.g. CCS Enterprise"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-sm"
              />
            </div>

            <div className="text-left">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-4 mb-1.5 block">Select Initial Subscription Tier</label>
              <div className="grid grid-cols-3 gap-2">
                {(['BASIC', 'STANDARD', 'ENTERPRISE'] as SubscriptionPlanType[]).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setNewCompanyTier(tier)}
                    className={`p-3 rounded-2xl border text-xs font-bold transition-all text-center flex flex-col items-center justify-center gap-1 ${
                      newCompanyTier === tier
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-[1.02]'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>{tier} TIER</span>
                    <span className="text-[9px] font-normal opacity-80">
                      {tier === 'BASIC' ? 'Trade Essentials' : tier === 'STANDARD' ? 'Operations Tier' : 'Full Suite'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            
            <button 
              onClick={() => registerCompany(newCompanyName.trim() || 'Akipo Enterprise', newCompanyTier)}
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Create Company & Enter Dashboard'
              )}
            </button>
            
            <button 
              onClick={signInAsDemo}
              className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 py-4 rounded-2xl font-bold active:scale-95 transition-all text-sm mb-2"
            >
              Switch to Training Demo Mode
            </button>

            <button 
              onClick={() => {
                if (confirm("Are you sure you want to delete your profile data to re-register cleanly?")) {
                  deleteUserAccount();
                }
              }}
              className="w-full text-rose-500 py-1 text-xs font-bold hover:text-rose-700 transition-colors"
            >
              Reset / Delete Profile & Re-register
            </button>

            <button 
              onClick={logout}
              className="w-full text-slate-400 py-2 text-sm font-bold hover:text-slate-600 transition-colors"
            >
              Cancel & Sign Out
            </button>
          </div>
          {renderUserCompaniesList()}
        </div>
      </div>
    );
  }

  if (mustChangePassword) {
    return <ChangePasswordPage />;
  }

  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Home' },
    { id: 'suppliers', icon: Users, label: 'Suppliers', hidden: !can('manage_suppliers') || !isModuleEnabled('suppliers') },
    { id: 'buyers', icon: UserPlus, label: 'Buyers', hidden: !can('manage_buyers') || !isModuleEnabled('buyers') },
    { id: 'inventory', icon: Package, label: 'Stock', hidden: !can('manage_inventory') || !isModuleEnabled('inventory') },
    { id: 'store', icon: Package, label: 'Store Records', hidden: !can('manage_store_records') || !isModuleEnabled('store') },
    { id: 'warehouses', icon: Building2, label: 'Stores', hidden: !can('manage_warehouses') || !isModuleEnabled('warehouses') },
    { id: 'purchases', icon: ShoppingCart, label: 'Buy', hidden: !can('manage_inventory') || !isModuleEnabled('purchases') },
    { id: 'sales', icon: TrendingUp, label: 'Sales', hidden: !can('manage_inventory') || !isModuleEnabled('sales') },
    { id: 'journal', icon: Receipt, label: 'Journal', hidden: !can('manage_journal') || !isModuleEnabled('journal') },
    { id: 'petty_cash', icon: Wallet, label: 'Petty Cash', hidden: !can('manage_petty_cash') || !isModuleEnabled('petty_cash') },
    { id: 'staff', icon: Users, label: 'Staff', hidden: !can('manage_staff') || !isModuleEnabled('staff') },
    { id: 'analytics', icon: BarChart3, label: 'Data', hidden: !can('view_analytics') || !isModuleEnabled('analytics') },
    { id: 'reports', icon: FileText, label: 'Docs', hidden: !can('view_reports') || !isModuleEnabled('reports') },
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
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-6 text-center">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl w-full max-w-md">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
          <h2 className="text-2xl font-black text-slate-900 mb-2">Connecting...</h2>
          <p className="text-slate-500 mb-8 text-sm">Loading your registered company profile. If this takes too long, your connection may be slow, or the database record might be unavailable.</p>
          
          <button 
            onClick={logout}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-4 rounded-2xl font-bold active:scale-95 transition-all mb-3 text-sm"
          >
            Sign Out
          </button>

          <button 
            onClick={resetProfileCompany}
            className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-600 py-4 rounded-2xl font-bold active:scale-95 transition-all text-sm mb-3"
          >
            Register a Different Company
          </button>

          <button 
            onClick={signInAsDemo}
            className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 py-4 rounded-2xl font-bold active:scale-95 transition-all text-sm"
          >
            Switch to Training Demo Mode
          </button>
        </div>
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
            onClick={async () => {
              if (company?.id) {
                await approveCompany(company.id);
              }
            }}
            className="w-full bg-[var(--accent)] hover:bg-blue-700 text-white py-4 rounded-2xl font-bold active:scale-95 transition-all text-sm mb-3 shadow-md"
          >
            Activate Company & Enter Dashboard
          </button>

          <button 
            onClick={logout}
            className="w-full bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold active:scale-95 transition-all mb-3 text-sm"
          >
            Sign Out
          </button>

          <button 
            onClick={resetProfileCompany}
            className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-600 py-4 rounded-2xl font-bold active:scale-95 transition-all text-sm mb-3"
          >
            Register a Different Company
          </button>

          <button 
            onClick={signInAsDemo}
            className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 py-4 rounded-2xl font-bold active:scale-95 transition-all text-sm"
          >
            Switch to Training Demo Mode
          </button>
          {renderUserCompaniesList()}
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
                {isSuperAdmin && (
                  <div className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter ${
                    (import.meta.env.VITE_APP_ENV || 'development') === 'production' 
                      ? 'bg-rose-100 text-rose-600 border border-rose-200' 
                      : (import.meta.env.VITE_APP_ENV || 'development') === 'staging'
                      ? 'bg-amber-100 text-amber-600 border border-amber-200'
                      : 'bg-indigo-100 text-indigo-600 border border-indigo-200'
                  }`}>
                    {import.meta.env.VITE_APP_ENV || 'development'}
                  </div>
                )}
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
        
        <div className="flex items-center gap-2">
          <NotificationsBell />
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
            {activeModule !== 'dashboard' && activeModule !== 'superadmin' && activeModule !== 'settings' && !isModuleEnabled(activeModule) ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-slate-50">
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl max-w-md w-full">
                  <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-200 shadow-sm">
                    <Lock size={32} />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-2">Module Access Locked</h3>
                  <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                    The <strong>{activeModule.toUpperCase()}</strong> module is not enabled for your company's current subscription plan ({company?.subscriptionPlan || 'Basic Tier'}).
                  </p>
                  <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4 text-left mb-6">
                    <p className="text-[11px] font-bold text-indigo-900 mb-1 flex items-center gap-1.5">
                      <ShieldAlert size={14} /> Subscription Upgrade Required
                    </p>
                    <p className="text-[10px] text-indigo-700 leading-relaxed">
                      Please contact your system Super Administrator or account manager to enable this module for your organization.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveModule('dashboard')}
                    className="w-full bg-[var(--accent)] text-white font-bold py-3.5 px-4 rounded-xl text-xs hover:bg-blue-700 transition-all shadow-md active:scale-95"
                  >
                    Return to Home Dashboard
                  </button>
                </div>
              </div>
            ) : (
              <>
                {activeModule === 'dashboard' && <Dashboard onNavigate={setActiveModule} />}
                {activeModule === 'suppliers' && <SupplierModule />}
                {activeModule === 'buyers' && <BuyerModule />}
                {activeModule === 'inventory' && <InventoryModule />}
                {activeModule === 'purchases' && <InventoryModule />}
                {activeModule === 'sales' && <SalesModule />}
                {activeModule === 'journal' && <JournalModule />}
                {activeModule === 'petty_cash' && <PettyCashModule />}
                {activeModule === 'staff' && <StaffModule />}
                {activeModule === 'warehouses' && <WarehouseModule />}
                {activeModule === 'store' && <StoreKeeperModule />}
                {activeModule === 'analytics' && <AnalyticsModule />}
                {activeModule === 'reports' && <ReportsModule />}
                {activeModule === 'superadmin' && <SuperAdminModule />}
              </>
            )}
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

