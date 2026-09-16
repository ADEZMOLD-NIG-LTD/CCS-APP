/**
 * Platform administration. Only users listed in platform_admins can reach this screen, and the
 * Firestore rules independently restrict every read and write below to platform admins.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, Building2, CheckCircle2, Clock, ExternalLink, Mail, Megaphone, Pencil, PauseCircle, PlayCircle,
  Plus, RotateCcw, Search, Server, ShieldAlert, ShieldCheck, Trash2, Users,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { db } from '../firebase';
import { collection, onSnapshot } from '../lib/fs';
import { useAuth } from '../contexts/AuthContext';
import { useCommit } from '../hooks/useCommit';
import { AuditAction, auditOp } from '../lib/audit';
import { COMPANY_ROLES, ROLE_LABELS } from '../lib/permissions';
import { cn, isValidEmail, newId, normalizeEmail } from '../lib/utils';
import { logger } from '../lib/logger';
import { ALL_MODULE_IDS, ALL_SYSTEM_MODULES, SUBSCRIPTION_PRESETS, type SubscriptionPlanType } from '../constants/modules';
import { FIREBASE_PROJECT_ID } from '../constants/app';
import { appEnv } from '../firebase';
import type { WriteOp } from '../lib/writes';
import type { Company, UserProfile } from '../types';
import BroadcastModule from './BroadcastModule';
import ConfirmModal from './ConfirmModal';

type Tab = 'companies' | 'users' | 'broadcast' | 'system';

function companyStatus(c: Company): 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DELETED' {
  if (c.isDeleted || c.status === 'DELETED') return 'DELETED';
  if (c.status === 'SUSPENDED') return 'SUSPENDED';
  if (!c.isApproved || c.status === 'PENDING') return 'PENDING';
  return 'ACTIVE';
}

const STATUS_STYLES = {
  PENDING: 'bg-amber-50 text-amber-700',
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  SUSPENDED: 'bg-rose-50 text-rose-700',
  DELETED: 'bg-slate-100 text-slate-500',
};

export default function SuperAdminModule() {
  const { user, isSuperAdmin, setErrorMessage } = useAuth();
  const { commit, busy } = useCommit();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [tab, setTab] = useState<Tab>('companies');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DELETED'>('ALL');
  const [editingCompany, setEditingCompany] = useState<Company | 'new' | null>(null);
  const [approving, setApproving] = useState(false);
  const [deletingCompany, setDeletingCompany] = useState<Company | null>(null);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [removingUser, setRemovingUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const unsubCompanies = onSnapshot(
      collection(db, 'companies'),
      snapshot => setCompanies(snapshot.docs.map(d => ({ ...(d.data() as Company), id: d.id }))),
      error => logger.error('Companies unavailable', error)
    );
    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      snapshot => setUsers(snapshot.docs.map(d => ({ ...(d.data() as UserProfile), uid: d.id }))),
      error => logger.error('Users unavailable', error)
    );
    return () => {
      unsubCompanies();
      unsubUsers();
    };
  }, [isSuperAdmin]);

  const companyById = useMemo(() => Object.fromEntries(companies.map(c => [c.id, c])), [companies]);

  const filteredCompanies = useMemo(() => {
    const q = search.trim().toLowerCase();
    return companies
      .filter(c => statusFilter === 'ALL' ? companyStatus(c) !== 'DELETED' : companyStatus(c) === statusFilter)
      .filter(c => !q || c.name?.toLowerCase().includes(q) || c.ownerEmail?.toLowerCase().includes(q))
      .sort((a, b) => {
        const order = { PENDING: 0, ACTIVE: 1, SUSPENDED: 2, DELETED: 3 };
        return order[companyStatus(a)] - order[companyStatus(b)] || new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
  }, [companies, search, statusFilter]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users
      .filter(u => !q || u.displayName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || companyById[u.companyId]?.name?.toLowerCase().includes(q))
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [users, search, companyById]);

  const stats = useMemo(() => ({
    pending: companies.filter(c => companyStatus(c) === 'PENDING').length,
    active: companies.filter(c => companyStatus(c) === 'ACTIVE').length,
    suspended: companies.filter(c => companyStatus(c) === 'SUSPENDED').length,
    deletionRequests: companies.filter(c => c.deletionRequestedAt && companyStatus(c) !== 'DELETED').length,
    users: users.length,
    suspendedUsers: users.filter(u => u.suspended || (u.status && u.status !== 'ACTIVE')).length,
  }), [companies, users]);

  if (!isSuperAdmin || !user) return null;

  const adminActor = (companyId: string) => ({ companyId, uid: user.uid, email: normalizeEmail(user.email) });
  const nowIso = () => new Date().toISOString();

  const saveCompany = async (values: { name: string; ownerEmail: string; plan: SubscriptionPlanType; modules: string[]; ownerUid?: string }) => {
    if (values.modules.length === 0) {
      return void alertError('Enable at least one module.');
    }
    const plan = values.plan;
    if (editingCompany === 'new') {
      if (!isValidEmail(values.ownerEmail)) return void alertError('Enter a valid owner email.');
      const id = `comp_${newId()}`;
      const data = {
        id,
        name: values.name.trim(),
        ownerEmail: values.ownerEmail,
        createdAt: nowIso(),
        isApproved: true,
        status: 'ACTIVE',
        subscriptionPlan: plan,
        enabledModules: values.modules,
        approvedAt: nowIso(),
        approvedBy: user.uid,
      };
      const ok = await commit(
        [
          { kind: 'set', collection: 'companies', id, data },
          auditOp(adminActor(id), { action: AuditAction.CREATE, module: 'Platform', recordId: id, details: `Created company ${data.name} for ${data.ownerEmail}`, newData: data }),
        ],
        { success: `${data.name} created. The owner can sign in with ${data.ownerEmail} (verified) to claim it.`, context: 'companies' }
      );
      if (ok) setEditingCompany(null);
      return;
    }
    if (!editingCompany) return;
    const target = editingCompany;
    const data: Record<string, unknown> = {
      name: values.name.trim(),
      subscriptionPlan: plan,
      enabledModules: values.modules,
      updatedAt: nowIso(),
    };
    if (values.ownerUid && values.ownerUid !== target.ownerUid) {
      const newOwner = users.find(u => u.uid === values.ownerUid);
      data.ownerUid = values.ownerUid;
      data.ownerEmail = normalizeEmail(newOwner?.email) || target.ownerEmail;
    }
    if (approving) {
      data.isApproved = true;
      data.status = 'ACTIVE';
      data.approvedAt = nowIso();
      data.approvedBy = user.uid;
    }
    const ok = await commit(
      [
        { kind: 'update', collection: 'companies', id: target.id, data },
        auditOp(adminActor(target.id), {
          action: AuditAction.UPDATE,
          module: 'Platform',
          recordId: target.id,
          details: approving ? `Approved ${values.name} on the ${plan} plan` : `Updated company ${values.name}`,
          previousData: target,
          newData: data,
        }),
      ],
      { success: approving ? `${values.name} approved.` : 'Company updated.', context: 'companies' }
    );
    if (ok) {
      setEditingCompany(null);
      setApproving(false);
    }
  };

  function alertError(message: string) {
    setErrorMessage(message);
  }

  const setCompanyStatus = (c: Company, status: 'ACTIVE' | 'SUSPENDED') => {
    commit(
      [
        { kind: 'update', collection: 'companies', id: c.id, data: { status, updatedAt: nowIso() } },
        auditOp(adminActor(c.id), { action: AuditAction.UPDATE, module: 'Platform', recordId: c.id, details: `${status === 'SUSPENDED' ? 'Suspended' : 'Reactivated'} company ${c.name}` }),
      ],
      { success: `${c.name} ${status === 'SUSPENDED' ? 'suspended' : 'reactivated'}.`, context: 'companies' }
    );
  };

  const deleteCompany = async (reason?: string) => {
    const c = deletingCompany;
    if (!c || !reason?.trim()) return;
    const ok = await commit(
      [
        { kind: 'update', collection: 'companies', id: c.id, data: { status: 'DELETED', isDeleted: true, deletionReason: reason.trim(), deletedAt: nowIso(), deletedByUid: user.uid, updatedAt: nowIso() } },
        auditOp(adminActor(c.id), { action: AuditAction.DELETE, module: 'Platform', recordId: c.id, details: `Closed company ${c.name}. Reason: ${reason.trim()}` }),
      ],
      { success: `${c.name} closed. Members lost access immediately; data is retained and can be restored.`, context: 'companies' }
    );
    if (ok) setDeletingCompany(null);
  };

  const restoreCompany = (c: Company) => {
    commit(
      [
        { kind: 'update', collection: 'companies', id: c.id, data: { status: c.isApproved ? 'ACTIVE' : 'PENDING', isDeleted: false, deletionReason: null, deletedAt: null, deletedByUid: null, deletionRequestedAt: null, updatedAt: nowIso() } },
        auditOp(adminActor(c.id), { action: AuditAction.UPDATE, module: 'Platform', recordId: c.id, details: `Restored company ${c.name}` }),
      ],
      { success: `${c.name} restored.`, context: 'companies' }
    );
  };

  const toggleUserSuspension = (u: UserProfile) => {
    if (u.uid === user.uid) return void alertError('You cannot suspend yourself.');
    const suspended = !u.suspended;
    const ops: WriteOp[] = [{ kind: 'update', collection: 'users', id: u.uid, data: { suspended, updatedAt: nowIso() } }];
    if (u.companyId) {
      ops.push(auditOp(adminActor(u.companyId), { action: AuditAction.UPDATE, module: 'Platform', recordId: u.uid, details: `${suspended ? 'Suspended' : 'Unsuspended'} user ${u.email} platform-wide` }));
    }
    commit(ops, { success: `${u.email} ${suspended ? 'suspended' : 'unsuspended'}.`, context: 'users' });
  };

  const saveUser = async (values: { displayName: string; role: string; companyId: string; status: UserProfile['status'] }) => {
    if (!editingUser) return;
    const data = { displayName: values.displayName.trim(), role: values.role, companyId: values.companyId, status: values.status, updatedAt: nowIso() };
    const ops: WriteOp[] = [{ kind: 'update', collection: 'users', id: editingUser.uid, data }];
    if (values.companyId) {
      ops.push(auditOp(adminActor(values.companyId), { action: AuditAction.UPDATE, module: 'Platform', recordId: editingUser.uid, details: `Platform admin updated ${editingUser.email}: role ${values.role}, status ${values.status}`, previousData: editingUser, newData: data }));
    }
    if (await commit(ops, { success: 'User updated.', context: 'users' })) setEditingUser(null);
  };

  const removeUserProfile = async () => {
    const u = removingUser;
    if (!u) return;
    if (u.uid === user.uid) return void alertError('You cannot remove your own profile.');
    if (await commit([{ kind: 'delete', collection: 'users', id: u.uid }], { success: `Membership removed for ${u.email}. Their login still exists; disable it in the Firebase console if needed.`, context: 'users' })) {
      setRemovingUser(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-app)]">
      <ConfirmModal
        isOpen={!!deletingCompany}
        title="Close company"
        message={`Close ${deletingCompany?.name}? All members lose access immediately. Records are kept and the company can be restored.`}
        confirmText="Close company"
        requireReason
        onConfirm={deleteCompany}
        onCancel={() => setDeletingCompany(null)}
      />
      <ConfirmModal
        isOpen={!!removingUser}
        title="Remove membership"
        message={`Remove the profile for ${removingUser?.email}? They will lose access to their company. Their sign-in account is not deleted.`}
        confirmText="Remove"
        onConfirm={removeUserProfile}
        onCancel={() => setRemovingUser(null)}
      />

      <header className="bg-white border-b border-[var(--border)] px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Platform Administration</h1>
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{appEnv}</p>
          </div>
          {stats.pending > 0 && (
            <button onClick={() => { setTab('companies'); setStatusFilter('PENDING'); }} className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase flex items-center gap-1">
              <Clock size={12} /> {stats.pending} pending
            </button>
          )}
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto no-scrollbar">
          {([
            ['companies', Building2, 'Companies'],
            ['users', Users, 'Users'],
            ['broadcast', Megaphone, 'Announce'],
            ['system', Server, 'System'],
          ] as const).map(([id, Icon, label]) => (
            <button key={id} onClick={() => setTab(id)} className={cn('flex-1 py-2 px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-2 whitespace-nowrap', tab === id ? 'bg-white text-[var(--accent)] shadow-sm' : 'text-[var(--text-secondary)]')}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        {(tab === 'companies' || tab === 'users') && (
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={18} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={tab === 'companies' ? 'Search companies or owners…' : 'Search users…'}
                className="w-full bg-white border border-[var(--border)] rounded-2xl pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] shadow-sm" />
            </div>
            {tab === 'companies' && (
              <>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} className="bg-white border border-[var(--border)] rounded-2xl px-4 py-3 text-sm font-bold">
                  <option value="ALL">All open</option>
                  <option value="PENDING">Pending</option>
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="DELETED">Closed</option>
                </select>
                <button onClick={() => { setApproving(false); setEditingCompany('new'); }} className="bg-[var(--accent)] text-white py-3 px-4 rounded-2xl font-bold text-xs uppercase flex items-center justify-center gap-2">
                  <Plus size={15} /> New company
                </button>
              </>
            )}
          </div>
        )}

        {tab === 'companies' && filteredCompanies.map(c => {
          const status = companyStatus(c);
          const memberCount = users.filter(u => u.companyId === c.id).length;
          return (
            <div key={c.id} className="google-card p-4">
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold text-[var(--text-primary)] truncate">{c.name}</h3>
                  <p className="text-xs text-[var(--text-secondary)] truncate">{c.ownerEmail}{c.ownerUid ? '' : ' · not yet claimed'}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px]">
                    <span className="text-[var(--text-secondary)]">Registered {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 font-bold">{c.subscriptionPlan || (c.requestedPlan ? `Requested: ${c.requestedPlan}` : 'No plan')}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 font-bold">{c.enabledModules?.length || ALL_MODULE_IDS.length}/{ALL_MODULE_IDS.length} modules</span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 font-bold">{memberCount} member{memberCount === 1 ? '' : 's'}</span>
                    {c.deletionRequestedAt && status !== 'DELETED' && <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-bold">Deletion requested</span>}
                  </div>
                </div>
                <span className={cn('px-3 py-1 rounded-full text-[10px] font-bold uppercase shrink-0', STATUS_STYLES[status])}>{status}</span>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-50 flex flex-wrap gap-2">
                {status === 'PENDING' && (
                  <button onClick={() => { setApproving(true); setEditingCompany(c); }} className="flex-1 bg-[var(--accent)] text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                    <CheckCircle2 size={16} /> Review & approve
                  </button>
                )}
                {status === 'ACTIVE' && (
                  <button onClick={() => setCompanyStatus(c, 'SUSPENDED')} disabled={busy} className="flex-1 bg-rose-50 text-rose-600 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                    <PauseCircle size={16} /> Suspend
                  </button>
                )}
                {status === 'SUSPENDED' && (
                  <button onClick={() => setCompanyStatus(c, 'ACTIVE')} disabled={busy} className="flex-1 bg-emerald-50 text-emerald-700 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                    <PlayCircle size={16} /> Reactivate
                  </button>
                )}
                {status === 'DELETED' ? (
                  <button onClick={() => restoreCompany(c)} disabled={busy} className="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                    <RotateCcw size={16} /> Restore
                  </button>
                ) : (
                  <>
                    <button onClick={() => { setApproving(false); setEditingCompany(c); }} className="px-3 bg-indigo-50 text-indigo-700 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5">
                      <Pencil size={15} /> Edit
                    </button>
                    <button onClick={() => setDeletingCompany(c)} className="px-3 bg-slate-50 text-slate-400 hover:text-rose-600 py-2.5 rounded-xl" aria-label={`Close ${c.name}`}>
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {tab === 'companies' && filteredCompanies.length === 0 && <p className="text-center text-slate-400 text-sm py-10">No companies match.</p>}

        {tab === 'users' && filteredUsers.map(u => {
          const inactive = u.suspended || (u.status && u.status !== 'ACTIVE');
          return (
            <div key={u.uid} className="google-card p-4">
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold text-[var(--text-primary)] truncate">{u.displayName || 'Unnamed user'}</h3>
                  <p className="text-xs text-[var(--text-secondary)] truncate">{u.email}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold bg-slate-100 text-[var(--text-secondary)] px-2 py-0.5 rounded uppercase">{u.role}</span>
                    <span className="text-[10px] text-[var(--text-secondary)]">{companyById[u.companyId]?.name || 'No company'}</span>
                  </div>
                </div>
                <span className={cn('px-3 py-1 rounded-full text-[10px] font-bold uppercase flex items-center gap-1 shrink-0', inactive ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600')}>
                  {inactive ? <ShieldAlert size={12} /> : <ShieldCheck size={12} />}
                  {u.suspended ? 'Suspended' : u.status && u.status !== 'ACTIVE' ? u.status : 'Active'}
                </span>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-50 flex gap-2">
                <button onClick={() => setEditingUser(u)} className="flex-1 bg-indigo-50 text-indigo-600 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2"><Pencil size={16} /> Edit</button>
                {u.uid !== user.uid && (
                  <>
                    <button onClick={() => toggleUserSuspension(u)} disabled={busy} className={cn('px-4 py-2.5 rounded-xl font-bold text-sm', u.suspended ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600')} aria-label={u.suspended ? 'Unsuspend' : 'Suspend'}>
                      {u.suspended ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
                    </button>
                    <button onClick={() => setRemovingUser(u)} className="px-4 bg-slate-50 text-slate-400 hover:text-rose-600 py-2.5 rounded-xl" aria-label="Remove membership"><Trash2 size={16} /></button>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {tab === 'broadcast' && <BroadcastModule companies={companies.filter(c => companyStatus(c) === 'ACTIVE')} />}

        {tab === 'system' && <SystemPanel stats={stats} />}
      </main>

      <AnimatePresence>
        {editingCompany && (
          <CompanyEditor
            company={editingCompany === 'new' ? null : editingCompany}
            approving={approving}
            members={editingCompany === 'new' ? [] : users.filter(u => u.companyId === editingCompany.id)}
            busy={busy}
            onCancel={() => { setEditingCompany(null); setApproving(false); }}
            onSave={saveCompany}
          />
        )}
        {editingUser && (
          <UserEditor user={editingUser} companies={companies.filter(c => companyStatus(c) !== 'DELETED')} busy={busy} onCancel={() => setEditingUser(null)} onSave={saveUser} />
        )}
      </AnimatePresence>
    </div>
  );
}

function Modal({ title, subtitle, children, onClose }: { title: string; subtitle?: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white rounded-3xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto" role="dialog" aria-label={title}>
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="font-black text-slate-900 text-lg">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-lg" aria-label="Close">✕</button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function CompanyEditor({ company, approving, members, busy, onCancel, onSave }: {
  company: Company | null;
  approving: boolean;
  members: UserProfile[];
  busy: boolean;
  onCancel: () => void;
  onSave: (values: { name: string; ownerEmail: string; plan: SubscriptionPlanType; modules: string[]; ownerUid?: string }) => void;
}) {
  const initialPlan: SubscriptionPlanType = company?.subscriptionPlan || company?.requestedPlan || 'BASIC';
  const [name, setName] = useState(company?.name ?? '');
  const [ownerEmail, setOwnerEmail] = useState(company?.ownerEmail ?? '');
  const [ownerUid, setOwnerUid] = useState(company?.ownerUid ?? '');
  const [plan, setPlan] = useState<SubscriptionPlanType>(initialPlan);
  const [modules, setModules] = useState<string[]>(
    company?.enabledModules?.length ? company.enabledModules : initialPlan !== 'CUSTOM' ? SUBSCRIPTION_PRESETS[initialPlan].modules : ALL_MODULE_IDS
  );

  const choosePlan = (next: SubscriptionPlanType) => {
    setPlan(next);
    if (next !== 'CUSTOM') setModules(SUBSCRIPTION_PRESETS[next].modules);
  };
  const toggleModule = (id: string) => {
    setPlan('CUSTOM');
    setModules(prev => (prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]));
  };
  const admins = members.filter(m => m.role === 'ADMIN');

  return (
    <Modal title={company ? (approving ? 'Review company' : 'Edit company') : 'New company'} subtitle={approving ? `Requested plan: ${company?.requestedPlan ?? 'not specified'}` : undefined} onClose={onCancel}>
      <form onSubmit={e => { e.preventDefault(); onSave({ name, ownerEmail: normalizeEmail(ownerEmail), plan, modules, ownerUid: ownerUid || undefined }); }} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-xs font-bold text-slate-600 mb-1">Company name</span>
            <input required maxLength={120} value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm" />
          </label>
          {company ? (
            <label className="block">
              <span className="block text-xs font-bold text-slate-600 mb-1">Owner</span>
              <select value={ownerUid} onChange={e => setOwnerUid(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm">
                <option value={company.ownerUid ?? ''}>{company.ownerEmail}{company.ownerUid ? '' : ' (unclaimed)'}</option>
                {admins.filter(a => a.uid !== company.ownerUid).map(a => <option key={a.uid} value={a.uid}>Transfer to {a.email}</option>)}
              </select>
            </label>
          ) : (
            <label className="block">
              <span className="block text-xs font-bold text-slate-600 mb-1">Owner email</span>
              <input required type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm" />
            </label>
          )}
        </div>

        <div>
          <p className="text-xs font-black text-slate-900 uppercase mb-2">Plan</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(['BASIC', 'STANDARD', 'ENTERPRISE', 'CUSTOM'] as SubscriptionPlanType[]).map(p => (
              <button key={p} type="button" onClick={() => choosePlan(p)} className={cn('py-2.5 rounded-xl text-xs font-bold border', plan === p ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'bg-white text-slate-700 border-slate-200')}>
                {p}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-black text-slate-900 uppercase mb-2">Modules ({modules.length}/{ALL_MODULE_IDS.length})</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
            {ALL_SYSTEM_MODULES.map(mod => (
              <label key={mod.id} className={cn('p-3 rounded-2xl border flex items-start gap-3 cursor-pointer', modules.includes(mod.id) ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-50/60 border-slate-200 opacity-70')}>
                <input type="checkbox" checked={modules.includes(mod.id)} onChange={() => toggleModule(mod.id)} className="mt-1 h-4 w-4" />
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-slate-900">{mod.name}</span>
                  <span className="block text-[10px] text-slate-500">{mod.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold text-sm">Cancel</button>
          <button type="submit" disabled={busy || modules.length === 0} className="flex-1 bg-[var(--accent)] text-white py-3 rounded-xl font-bold text-sm disabled:opacity-50">
            {busy ? 'Saving…' : approving ? 'Approve company' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function UserEditor({ user, companies, busy, onCancel, onSave }: {
  user: UserProfile;
  companies: Company[];
  busy: boolean;
  onCancel: () => void;
  onSave: (values: { displayName: string; role: string; companyId: string; status: UserProfile['status'] }) => void;
}) {
  const [displayName, setDisplayName] = useState(user.displayName ?? '');
  const [role, setRole] = useState<string>(COMPANY_ROLES.includes(user.role as never) ? user.role : 'STAFF');
  const [companyId, setCompanyId] = useState(user.companyId ?? '');
  const [status, setStatus] = useState<UserProfile['status']>(user.status ?? 'ACTIVE');

  return (
    <Modal title="Edit user" subtitle={user.email} onClose={onCancel}>
      <form onSubmit={e => { e.preventDefault(); onSave({ displayName, role, companyId, status }); }} className="space-y-4">
        <label className="block">
          <span className="block text-xs font-bold text-slate-600 mb-1">Display name</span>
          <input required maxLength={120} value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm" />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="block">
            <span className="block text-xs font-bold text-slate-600 mb-1">Company</span>
            <select value={companyId} onChange={e => setCompanyId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm">
              <option value="">No company</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-bold text-slate-600 mb-1">Role</span>
            <select value={role} onChange={e => setRole(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm">
              {COMPANY_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-bold text-slate-600 mb-1">Company status</span>
            <select value={status} onChange={e => setStatus(e.target.value as UserProfile['status'])} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm">
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="DISMISSED">Dismissed</option>
            </select>
          </label>
        </div>
        <p className="text-[11px] text-slate-500 bg-slate-50 rounded-xl p-3">Changing a user's company does not change who owns any company. Platform admin rights are managed only with the admin script (see DEPLOYMENT.md).</p>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold text-sm">Cancel</button>
          <button type="submit" disabled={busy} className="flex-1 bg-[var(--accent)] text-white py-3 rounded-xl font-bold text-sm disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}

function SystemPanel({ stats }: { stats: Record<string, number> }) {
  const { user } = useAuth();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const testEmail = async () => {
    if (!user) return;
    setTesting(true);
    setResult(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/test-email', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const isJson = response.headers.get('content-type')?.includes('application/json');
      if (!isJson) {
        setResult({ ok: false, message: 'The email API is not deployed with this site (static hosting). See DEPLOYMENT.md → API server.' });
        return;
      }
      const body = (await response.json()) as { error?: string };
      setResult(response.ok ? { ok: true, message: `Test email sent to ${user.email}.` } : { ok: false, message: body.error || 'The test failed.' });
    } catch {
      setResult({ ok: false, message: 'Could not reach the email API.' });
    } finally {
      setTesting(false);
    }
  };

  const consoleBase = FIREBASE_PROJECT_ID ? `https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}` : 'https://console.firebase.google.com';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          ['Pending approval', stats.pending],
          ['Active companies', stats.active],
          ['Suspended companies', stats.suspended],
          ['Deletion requests', stats.deletionRequests],
          ['User profiles', stats.users],
          ['Inactive users', stats.suspendedUsers],
        ].map(([label, value]) => (
          <div key={label as string} className="google-card p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase">{label}</p>
            <p className="text-2xl font-black text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="google-card p-6 space-y-3">
        <h3 className="font-bold flex items-center gap-2"><Activity size={18} /> Firebase console</h3>
        <p className="text-xs text-slate-500">Usage, billing, quotas and sign-in providers are managed in the Firebase console.</p>
        <div className="flex flex-wrap gap-2">
          {[['Usage & billing', '/usage'], ['Authentication', '/authentication/users'], ['Firestore rules', '/firestore/rules'], ['Authorized domains', '/authentication/settings']].map(([label, path]) => (
            <a key={path} href={`${consoleBase}${path}`} target="_blank" rel="noreferrer" className="text-xs font-bold bg-slate-100 text-slate-700 px-3 py-2 rounded-xl flex items-center gap-1">
              {label} <ExternalLink size={12} />
            </a>
          ))}
        </div>
      </div>

      <div className="google-card p-6 space-y-3">
        <h3 className="font-bold flex items-center gap-2"><Mail size={18} /> Email delivery test</h3>
        <p className="text-xs text-slate-500">Sends a test message from the API server to your own address ({user?.email}).</p>
        <button onClick={testEmail} disabled={testing} className="bg-[var(--accent)] text-white px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-50">
          {testing ? 'Sending…' : 'Send test email'}
        </button>
        {result && <p className={cn('text-xs font-medium rounded-lg p-3', result.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>{result.message}</p>}
      </div>
    </div>
  );
}
