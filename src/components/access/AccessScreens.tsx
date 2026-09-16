/**
 * Full-screen states shown before a user can enter the main application.
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, Building2, CheckCircle2, Clock, LogOut, Mail, RefreshCw, ShieldAlert, UserPlus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ALL_MODULE_IDS, ALL_SYSTEM_MODULES, SUBSCRIPTION_PRESETS } from '../../constants/modules';
import { ROLE_LABELS } from '../../lib/permissions';
import { koboToNaira } from '../../lib/billing';
import { formatCurrency } from '../../lib/utils';

function Card({ icon, tone = 'indigo', title, children }: { icon: React.ReactNode; tone?: 'indigo' | 'amber' | 'rose' | 'emerald'; title: string; children: React.ReactNode }) {
  const tones = {
    indigo: 'bg-indigo-50 text-indigo-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl w-full max-w-md"
      >
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 ${tones[tone]}`}>{icon}</div>
        <h2 className="text-2xl font-black text-slate-900 mb-2 text-center">{title}</h2>
        {children}
      </motion.div>
    </div>
  );
}

function Messages() {
  const { errorMessage, successMessage, setErrorMessage, setSuccessMessage } = useAuth();
  return (
    <>
      {errorMessage && (
        <div className="mb-4 bg-rose-50 border border-rose-200 rounded-2xl p-3 text-xs font-bold text-rose-800 flex gap-2" role="alert">
          <AlertCircle size={16} className="shrink-0" />
          <span className="flex-1">{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-rose-500" aria-label="Dismiss">×</button>
        </div>
      )}
      {successMessage && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-xs font-bold text-emerald-800 flex gap-2" role="status">
          <CheckCircle2 size={16} className="shrink-0" />
          <span className="flex-1">{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-500" aria-label="Dismiss">×</button>
        </div>
      )}
    </>
  );
}

function SignOutButton() {
  const { logout } = useAuth();
  return (
    <button onClick={logout} className="w-full text-slate-400 py-3 text-sm font-bold hover:text-slate-600 flex items-center justify-center gap-2">
      <LogOut size={16} /> Sign out
    </button>
  );
}

export function LoadingScreen({ label = 'Loading your workspace…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center" role="status" aria-live="polite">
      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest">{label}</p>
    </div>
  );
}

export function VerifyEmailScreen() {
  const { user, resendVerificationEmail, refreshUser } = useAuth();
  const [busy, setBusy] = useState(false);
  return (
    <Card icon={<Mail size={32} />} title="Verify your email">
      <p className="text-slate-500 text-sm text-center mb-6">
        We sent a verification link to <strong>{user?.email}</strong>. Open it, then press “I've verified”.
      </p>
      <Messages />
      <div className="space-y-3">
        <button
          onClick={async () => { setBusy(true); await refreshUser(); setBusy(false); }}
          disabled={busy}
          className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <RefreshCw size={16} className={busy ? 'animate-spin' : ''} /> I've verified my email
        </button>
        <button onClick={resendVerificationEmail} className="w-full bg-slate-100 text-slate-700 py-3 rounded-2xl font-bold text-sm">
          Resend verification email
        </button>
        <SignOutButton />
      </div>
    </Card>
  );
}

export function OnboardingScreen() {
  const { user, pendingInvites, ownedCompanies, registerCompany, acceptInvite, switchCompany, enterDemoMode, emailVerified, usesPasswordSignIn, billingConfig } = useAuth();
  const [companyName, setCompanyName] = useState('');
  const [plan, setPlan] = useState<'BASIC' | 'STANDARD' | 'ENTERPRISE'>('BASIC');
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card icon={<Building2 size={32} />} title="Welcome to CCS">
      <p className="text-slate-500 text-sm text-center mb-6">
        Signed in as <strong>{user?.email}</strong>. Join your company or register a new one.
      </p>
      <Messages />

      {pendingInvites.length > 0 && (
        <div className="mb-6 space-y-2">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Invitations</h3>
          {pendingInvites.map(invite => (
            <div key={invite.id} className="flex items-center justify-between p-3 rounded-2xl border border-indigo-200 bg-indigo-50/60">
              <div className="min-w-0 pr-2">
                <p className="font-bold text-sm text-slate-900 truncate">{invite.companyName}</p>
                <p className="text-[10px] text-slate-500">Role: {ROLE_LABELS[invite.role] ?? invite.role}</p>
              </div>
              <button
                onClick={() => run(() => acceptInvite(invite))}
                disabled={busy}
                className="text-xs font-black bg-indigo-600 text-white px-3 py-2 rounded-xl disabled:opacity-50 flex items-center gap-1"
              >
                <UserPlus size={14} /> Join
              </button>
            </div>
          ))}
        </div>
      )}

      {ownedCompanies.length > 0 && (
        <div className="mb-6 space-y-2">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Companies you own</h3>
          {ownedCompanies.map(c => (
            <div key={c.id} className="flex items-center justify-between p-3 rounded-2xl border border-slate-200">
              <div className="min-w-0 pr-2">
                <p className="font-bold text-sm text-slate-900 truncate">{c.name}</p>
                <p className="text-[10px] text-slate-500">{c.isApproved ? 'Active' : 'Awaiting approval'}</p>
              </div>
              <button
                onClick={() => run(() => switchCompany(c.id))}
                disabled={busy}
                className="text-xs font-black bg-white border border-slate-200 text-indigo-600 px-3 py-2 rounded-xl disabled:opacity-50"
              >
                Open
              </button>
            </div>
          ))}
        </div>
      )}

      {!emailVerified && usesPasswordSignIn ? (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-4">
          Verify your email address to register a company or accept invitations.
        </p>
      ) : (
        <form
          onSubmit={e => {
            e.preventDefault();
            run(() => registerCompany(companyName, plan));
          }}
          className="space-y-4"
        >
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Register a new company</h3>
          <input
            required
            minLength={2}
            maxLength={120}
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
            placeholder="Company name"
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Requested plan</p>
            <div className="grid grid-cols-3 gap-2">
              {(['BASIC', 'STANDARD', 'ENTERPRISE'] as const).map(tier => {
                const price = billingConfig.plans[tier];
                return (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setPlan(tier)}
                    aria-pressed={plan === tier}
                    className={`p-2.5 rounded-2xl border text-[11px] font-bold ${plan === tier ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-700 border-slate-200'}`}
                  >
                    {tier}
                    {price.amountKobo > 0 && (
                      <span className={`block text-[9px] font-bold mt-0.5 ${plan === tier ? 'text-indigo-100' : 'text-slate-500'}`}>
                        {formatCurrency(koboToNaira(price.amountKobo))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {/* Details for the selected tier, so the choice is informed without crowding the row. */}
            <div className="mt-2 rounded-2xl bg-slate-50 border border-slate-200 p-3">
              <p className="text-[11px] font-bold text-slate-700">{SUBSCRIPTION_PRESETS[plan].label}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{SUBSCRIPTION_PRESETS[plan].description}</p>
              <p className="text-[10px] text-slate-400 mt-1.5">
                {SUBSCRIPTION_PRESETS[plan].modules.length === ALL_MODULE_IDS.length
                  ? 'Every module included'
                  : `Includes: ${SUBSCRIPTION_PRESETS[plan].modules.map(id => ALL_SYSTEM_MODULES.find(m => m.id === id)?.name ?? id).join(', ')}`}
              </p>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">Your plan is confirmed by the platform administrator when the company is approved.</p>
          </div>
          <button type="submit" disabled={busy} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold disabled:opacity-50">
            {busy ? 'Submitting…' : 'Register company'}
          </button>
        </form>
      )}

      <div className="mt-4 space-y-1">
        <button onClick={enterDemoMode} className="w-full bg-emerald-50 text-emerald-700 py-3 rounded-2xl font-bold text-sm">
          Try the training demo
        </button>
        <SignOutButton />
      </div>
    </Card>
  );
}

export function CompanyStatusScreen() {
  const { accessState, company, ownedCompanies, profile, switchCompany, pendingInvites, acceptInvite } = useAuth();
  const content: Record<string, { icon: React.ReactNode; tone: 'amber' | 'rose'; title: string; text: string }> = {
    PENDING_APPROVAL: {
      icon: <Clock size={32} />,
      tone: 'amber',
      title: 'Awaiting approval',
      text: `${company?.name ?? 'Your company'} has been registered and is waiting for a platform administrator to activate it. You'll get access as soon as it is approved.`,
    },
    COMPANY_SUSPENDED: {
      icon: <ShieldAlert size={32} />,
      tone: 'rose',
      title: 'Company suspended',
      text: `Access to ${company?.name ?? 'this company'} has been suspended. Contact support for assistance.`,
    },
    COMPANY_UNAVAILABLE: {
      icon: <AlertCircle size={32} />,
      tone: 'rose',
      title: 'Company unavailable',
      text: 'The company linked to your account no longer exists or you no longer have access to it.',
    },
    ACCOUNT_SUSPENDED: {
      icon: <ShieldAlert size={32} />,
      tone: 'rose',
      title: 'Access disabled',
      text: profile?.suspended
        ? 'Your account has been suspended by the platform administrator.'
        : 'Your access to this company has been suspended or removed by a company administrator.',
    },
  };
  const item = content[accessState] ?? content.COMPANY_UNAVAILABLE;

  const companyState = (c: typeof ownedCompanies[number]) => {
    if (c.isDeleted || c.status === 'DELETED') return { label: 'Closed', usable: false };
    if (c.status === 'SUSPENDED') return { label: 'Suspended', usable: false };
    if (c.isApproved !== true || c.status === 'PENDING') return { label: 'Awaiting approval', usable: false };
    return { label: 'Active', usable: true };
  };

  return (
    <Card icon={item.icon} tone={item.tone} title={item.title}>
      <p className="text-slate-500 text-sm text-center mb-6">{item.text}</p>
      <Messages />
      {!profile?.suspended && pendingInvites.map(invite => (
        <button key={invite.id} onClick={() => acceptInvite(invite)} className="w-full mb-2 bg-indigo-600 text-white py-3 rounded-2xl font-bold text-sm">
          Join {invite.companyName}
        </button>
      ))}
      {/* Each company shows why it can or cannot be opened: an "Open" button that silently does
          nothing is worse than one that explains itself. */}
      {!profile?.suspended && ownedCompanies.map(c => {
        const state = companyState(c);
        const isCurrent = c.id === profile?.companyId;
        return (
          <div key={c.id} className="w-full mb-2 flex items-center justify-between gap-3 p-3 rounded-2xl border border-slate-200">
            <div className="min-w-0 text-left">
              <p className="text-sm font-bold text-slate-900 truncate">{c.name}</p>
              <p className="text-[10px] text-slate-500">
                {state.label}{isCurrent ? ' · currently selected' : ''}
              </p>
            </div>
            <button
              onClick={() => switchCompany(c.id)}
              disabled={!state.usable || isCurrent}
              className="shrink-0 text-xs font-black px-3 py-2 rounded-xl bg-slate-100 text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isCurrent ? 'Selected' : 'Open'}
            </button>
          </div>
        );
      })}
      <SignOutButton />
    </Card>
  );
}
