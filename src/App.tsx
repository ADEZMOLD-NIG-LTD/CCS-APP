/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import {
  BarChart3, BookOpen, Building2, CreditCard, FileText, LayoutDashboard, Lock, LogOut, Menu, Package, Receipt,
  Settings, ShieldCheck, ShoppingCart, TrendingUp, UserPlus, Users, Wallet, WifiOff,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CompanyDataProvider } from './contexts/CompanyDataContext';
import { CompanyStatusScreen, LoadingScreen, OnboardingScreen, VerifyEmailScreen } from './components/access/AccessScreens';
import Dashboard from './components/Dashboard';
import LoginPage from './components/LoginPage';
import ChangePasswordPage from './components/ChangePasswordPage';
import SettingsPanel from './components/SettingsPanel';
import Toast from './components/Toast';
import FirebaseSetupGuide from './components/FirebaseSetupGuide';
import NotificationsBell from './components/NotificationsBell';
import { MODULE_VIEW_PERMISSION, ROLE_LABELS, type AppModuleKey } from './lib/permissions';
import { appEnv } from './firebase';

type ViewKey = AppModuleKey | 'settings' | 'superadmin' | 'billing';

const CHUNK_RELOAD_KEY = 'ccs_chunk_reload';

/**
 * Loads a module on first use (keeps the initial download small). After a new deployment the old
 * chunk files no longer exist, so a failed import reloads the page once to pick up the new build.
 */
function lazyModule<P>(loader: () => Promise<{ default: React.ComponentType<P> }>) {
  return lazy(() =>
    loader().then(
      module => {
        try { sessionStorage.removeItem(CHUNK_RELOAD_KEY); } catch { /* storage unavailable */ }
        return module;
      },
      error => {
        try {
          if (!sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
            sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
            window.location.reload();
            return new Promise<never>(() => undefined);
          }
        } catch { /* storage unavailable */ }
        throw error;
      }
    )
  );
}

const SupplierModule = lazyModule(() => import('./components/SupplierModule'));
const BuyerModule = lazyModule(() => import('./components/BuyerModule'));
const InventoryModule = lazyModule(() => import('./components/InventoryModule'));
const SalesModule = lazyModule(() => import('./components/SalesModule'));
const JournalModule = lazyModule(() => import('./components/JournalModule'));
const PettyCashModule = lazyModule(() => import('./components/PettyCashModule'));
const StaffModule = lazyModule(() => import('./components/StaffModule'));
const WarehouseModule = lazyModule(() => import('./components/WarehouseModule'));
const StoreKeeperModule = lazyModule(() => import('./components/StoreKeeperModule'));
const AnalyticsModule = lazyModule(() => import('./components/AnalyticsModule'));
const ReportsModule = lazyModule(() => import('./components/ReportsModule'));
const SuperAdminModule = lazyModule(() => import('./components/SuperAdminModule'));
const BillingPanel = lazyModule(() => import('./components/BillingPanel'));

function ModuleLoading() {
  return (
    <div className="flex items-center justify-center h-full p-8" role="status" aria-label="Loading">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-[var(--accent)] rounded-full animate-spin" />
    </div>
  );
}

const NAV_ITEMS: { id: Exclude<AppModuleKey, 'dashboard'>; icon: React.ComponentType<{ size?: number }>; label: string }[] = [
  { id: 'suppliers', icon: Users, label: 'Suppliers' },
  { id: 'buyers', icon: UserPlus, label: 'Buyers' },
  { id: 'inventory', icon: Package, label: 'Stock' },
  { id: 'purchases', icon: ShoppingCart, label: 'Buy' },
  { id: 'sales', icon: TrendingUp, label: 'Sales' },
  { id: 'store', icon: BookOpen, label: 'Store Records' },
  { id: 'warehouses', icon: Building2, label: 'Stores' },
  { id: 'journal', icon: Receipt, label: 'Journal' },
  { id: 'petty_cash', icon: Wallet, label: 'Petty Cash' },
  { id: 'staff', icon: Users, label: 'Staff' },
  { id: 'analytics', icon: BarChart3, label: 'Analytics' },
  { id: 'reports', icon: FileText, label: 'Reports' },
];

function GlobalToasts() {
  const { errorMessage, setErrorMessage, successMessage, setSuccessMessage } = useAuth();
  return (
    <AnimatePresence>
      {successMessage && <Toast key="success" message={successMessage} type="success" onClose={() => setSuccessMessage(null)} />}
      {errorMessage && <Toast key="error" message={errorMessage} type="error" onClose={() => setErrorMessage(null)} duration={8000} />}
    </AnimatePresence>
  );
}

function ModuleView({ view, onNavigate }: { view: ViewKey; onNavigate: (view: ViewKey) => void }) {
  switch (view) {
    case 'dashboard': return <Dashboard onNavigate={onNavigate} />;
    case 'suppliers': return <SupplierModule />;
    case 'buyers': return <BuyerModule />;
    case 'inventory': return <InventoryModule />;
    case 'purchases': return <InventoryModule startWithPurchase />;
    case 'sales': return <SalesModule />;
    case 'journal': return <JournalModule />;
    case 'petty_cash': return <PettyCashModule />;
    case 'staff': return <StaffModule />;
    case 'warehouses': return <WarehouseModule />;
    case 'store': return <StoreKeeperModule />;
    case 'analytics': return <AnalyticsModule />;
    case 'reports': return <ReportsModule />;
    case 'superadmin': return <SuperAdminModule />;
    case 'billing': return <div className="p-4 sm:p-8 max-w-3xl mx-auto"><BillingPanel /></div>;
    case 'settings': return <SettingsPanel />;
    default: return null;
  }
}

function MainShell({ superAdminOnly }: { superAdminOnly: boolean }) {
  const { profile, company, user, can, isModuleEnabled, isSuperAdmin, isDemoMode, isOnline, isReadOnly, logout, exitDemoMode } = useAuth();
  const [view, setView] = useState<ViewKey>(superAdminOnly ? 'superadmin' : 'dashboard');
  const [showMenu, setShowMenu] = useState(false);

  const navItems = useMemo(() => {
    if (superAdminOnly) return [];
    return NAV_ITEMS.filter(item => can(MODULE_VIEW_PERMISSION[item.id]) && isModuleEnabled(item.id));
  }, [superAdminOnly, can, isModuleEnabled]);

  // Subscription is reachable by a company admin (who pays) and a platform admin (who sets prices).
  const canSeeBilling = isSuperAdmin || (!superAdminOnly && profile?.role === 'ADMIN');

  const viewAllowed = (target: ViewKey): boolean => {
    if (target === 'settings') return true;
    if (target === 'superadmin') return isSuperAdmin;
    if (target === 'billing') return canSeeBilling;
    if (superAdminOnly) return false;
    if (target === 'dashboard') return true;
    return navItems.some(item => item.id === target);
  };

  // If a role or plan change removes access to the open module, fall back to a permitted view.
  useEffect(() => {
    if (!viewAllowed(view)) setView(superAdminOnly ? 'superadmin' : 'dashboard');
  });

  const navigate = (target: ViewKey) => {
    setView(target);
    setShowMenu(false);
  };

  const displayName = profile?.displayName || user?.displayName || user?.email || 'User';
  const roleLabel = profile && profile.role in ROLE_LABELS ? ROLE_LABELS[profile.role as keyof typeof ROLE_LABELS] : isSuperAdmin ? 'Platform admin' : '';

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-app)] font-sans text-[var(--text-primary)] overflow-hidden">
      <GlobalToasts />

      {isDemoMode && (
        <div className="bg-amber-500 text-amber-950 text-[11px] font-bold px-4 py-1.5 flex items-center justify-between gap-2">
          <span>Training mode — data is stored only in this browser and never reaches the live system.</span>
          <button onClick={exitDemoMode} className="underline shrink-0">Exit demo</button>
        </div>
      )}

      {isReadOnly && !superAdminOnly && (
        <div className="bg-rose-600 text-white text-[11px] font-bold px-4 py-1.5 flex items-center justify-between gap-2">
          <span>Subscription expired — the system is read only. Your records stay available to view and export.</span>
          <button onClick={() => navigate('settings')} className="underline shrink-0">Renew</button>
        </div>
      )}

      <header className="bg-white border-b border-[var(--border)] px-4 py-3 flex justify-between items-center z-50 shadow-sm shrink-0 relative">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setShowMenu(v => !v)}
            className={`p-2 rounded-xl transition-all ${showMenu ? 'bg-blue-50 text-[var(--accent)]' : 'hover:bg-slate-100 text-[var(--text-secondary)]'}`}
            aria-label="Open navigation"
            aria-expanded={showMenu}
          >
            <Menu size={24} />
          </button>
          <button className="flex items-center gap-3 min-w-0 text-left" onClick={() => navigate(superAdminOnly ? 'superadmin' : 'dashboard')}>
            <div className="w-10 h-10 bg-[var(--accent)] rounded-xl flex items-center justify-center text-white shadow-md shrink-0">
              <LayoutDashboard size={24} />
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="text-sm font-bold text-[var(--text-primary)] tracking-tight leading-tight truncate">
                {superAdminOnly ? 'Platform Administration' : company?.name || 'CCS'}
              </h1>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${isDemoMode ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                  {isDemoMode ? 'Training' : 'Live'}
                </p>
                {isSuperAdmin && appEnv !== 'production' && (
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-indigo-100 text-indigo-600">{appEnv}</span>
                )}
                {!isOnline && (
                  <span className="flex items-center gap-1 ml-2 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
                    <WifiOff size={10} className="text-rose-500" />
                    <span className="text-[8px] font-black text-rose-600 uppercase">Offline</span>
                  </span>
                )}
              </div>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <NotificationsBell />
          <button onClick={() => navigate('settings')} className="flex items-center gap-3 pl-3 border-l border-[var(--border)] group">
            <div className="text-right hidden sm:block">
              <p className="text-[11px] font-bold text-[var(--text-primary)] leading-none group-hover:text-[var(--accent)]">{displayName}</p>
              <p className="text-[9px] font-medium text-[var(--text-secondary)] uppercase tracking-tighter mt-0.5">{roleLabel}</p>
            </div>
            <div className="w-9 h-9 bg-slate-100 text-[var(--text-secondary)] rounded-xl flex items-center justify-center font-bold text-xs border border-[var(--border)]">
              {displayName.charAt(0).toUpperCase()}
            </div>
          </button>
        </div>

        <AnimatePresence>
          {showMenu && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowMenu(false)} className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40" />
              <motion.nav
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                className="absolute top-full left-4 mt-2 w-64 bg-white rounded-3xl shadow-2xl border border-slate-200 z-50 overflow-hidden flex flex-col max-h-[calc(100vh-100px)]"
              >
                <div className="p-2 grid grid-cols-1 gap-1 overflow-y-auto flex-1 custom-scrollbar">
                  {!superAdminOnly && (
                    <NavButton active={view === 'dashboard'} icon={LayoutDashboard} label="Home" onClick={() => navigate('dashboard')} />
                  )}
                  {navItems.map(item => (
                    <NavButton key={item.id} active={view === item.id} icon={item.icon} label={item.label} onClick={() => navigate(item.id)} />
                  ))}
                  {canSeeBilling && (
                    <NavButton active={view === 'billing'} icon={CreditCard} label="Subscription" onClick={() => navigate('billing')} />
                  )}
                  {isSuperAdmin && (
                    <NavButton active={view === 'superadmin'} icon={ShieldCheck} label="Platform Admin" onClick={() => navigate('superadmin')} />
                  )}
                </div>
                <div className="p-2 border-t border-[var(--border)] bg-slate-50 shrink-0">
                  <NavButton active={view === 'settings'} icon={Settings} label="Settings" onClick={() => navigate('settings')} />
                  <NavButton active={false} icon={LogOut} label={isDemoMode ? 'Exit demo' : 'Sign out'} onClick={logout} />
                </div>
              </motion.nav>
            </>
          )}
        </AnimatePresence>
      </header>

      <main className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div key={view} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }} className="h-full">
            {viewAllowed(view) ? (
              <Suspense fallback={<ModuleLoading />}>
                <ModuleView view={view} onNavigate={navigate} />
              </Suspense>
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl max-w-md w-full">
                  <Lock size={32} className="mx-auto text-amber-600 mb-4" />
                  <h3 className="text-xl font-black text-slate-900 mb-2">Not available</h3>
                  <p className="text-xs text-slate-600">This module is not enabled for your role or your company's plan.</p>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function NavButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: React.ComponentType<{ size?: number }>; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 w-full p-3 rounded-xl transition-all ${active ? 'bg-blue-50 text-[var(--accent)]' : 'hover:bg-slate-50 text-[var(--text-secondary)]'}`}
      aria-current={active ? 'page' : undefined}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${active ? 'bg-blue-100' : 'bg-slate-50'}`}>
        <Icon size={20} />
      </div>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

function AppContent() {
  const { accessState, mustChangePassword } = useAuth();

  switch (accessState) {
    case 'NOT_CONFIGURED':
      return (
        <>
          <GlobalToasts />
          <LoginPage />
        </>
      );
    case 'LOADING':
      return <LoadingScreen />;
    case 'SIGNED_OUT':
      return <LoginPage />;
    case 'VERIFY_EMAIL':
      return <VerifyEmailScreen />;
    case 'NO_COMPANY':
      return <OnboardingScreen />;
    case 'ACCOUNT_SUSPENDED':
    case 'COMPANY_UNAVAILABLE':
    case 'PENDING_APPROVAL':
    case 'COMPANY_SUSPENDED':
      return <CompanyStatusScreen />;
    case 'SUPER_ADMIN_ONLY':
      return <MainShell superAdminOnly />;
    case 'READY':
      return mustChangePassword ? <ChangePasswordPage /> : <MainShell superAdminOnly={false} />;
    default:
      return <FirebaseSetupGuide />;
  }
}

export default function App() {
  return (
    <AuthProvider>
      <CompanyDataProvider>
        <AppContent />
      </CompanyDataProvider>
    </AuthProvider>
  );
}
