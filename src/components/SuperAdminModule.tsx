import React, { useState, useEffect } from 'react';
import { Building2, CheckCircle2, XCircle, Search, Clock, Activity, Users, ShieldAlert, ShieldCheck, Database, Server, AlertTriangle, Trash2, UserMinus } from 'lucide-react';
import { collection, onSnapshot, query, orderBy, getDocs, doc, deleteDoc, writeBatch, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Company, UserProfile } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from './ConfirmModal';

export default function SuperAdminModule() {
  const { approveCompany, disapproveCompany, toggleUserSuspension, deleteUser, isFirestoreConnected } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'companies' | 'users' | 'health' | 'infrastructure'>('companies');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isPurging, setIsPurging] = useState(false);
  const [purgeConfirm, setPurgeConfirm] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'companies'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Company));
      setCompanies(data);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (activeTab === 'users') {
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile));
        setUsers(data);
      });
      return () => unsubscribe();
    }
  }, [activeTab]);

  const filteredCompanies = companies.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.ownerEmail.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredUsers = users.filter(u => 
    u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handlePurgeDemoUsers = async () => {
    setIsPurging(true);
    try {
      const q = query(
        collection(db, 'users'), 
        where('companyId', '==', 'demo_company')
      );
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      let count = 0;

      snapshot.docs.forEach((userDoc) => {
        // Don't delete the main demo profile
        if (userDoc.id !== 'demo_admin_profile') {
          batch.delete(userDoc.ref);
          count++;
        }
      });

      if (count > 0) {
        await batch.commit();
        alert(`Successfully purged ${count} duplicated demo users.`);
      } else {
        alert('No duplicated demo users found.');
      }
    } catch (error) {
      console.error('Purge failed:', error);
      alert('Failed to purge demo users.');
    } finally {
      setIsPurging(false);
      setPurgeConfirm(false);
    }
  };

  // System Health Mock Data (Calculated from state)
  const handleTestEmail = async () => {
    if (!testEmail) return;
    setIsTestingEmail(true);
    setTestResult(null);
    try {
      const response = await fetch('/api/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail }),
      });
      const data = await response.json();
      if (data.success) {
        setTestResult({ success: true, message: 'Test email sent successfully! Please check your inbox.' });
      } else {
        setTestResult({ success: false, message: `Error: ${data.error}. ${data.details || ''}` });
      }
    } catch (error: any) {
      setTestResult({ success: false, message: `Network error: ${error.message}` });
    } finally {
      setIsTestingEmail(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-app)]">
      <ConfirmModal
        isOpen={!!deleteConfirmId}
        title="Delete User Profile"
        message="Are you sure you want to delete this user profile? This action only removes the profile from the database, not the authentication record."
        onConfirm={() => {
          if (deleteConfirmId) {
            deleteUser(deleteConfirmId);
            setDeleteConfirmId(null);
          }
        }}
        onCancel={() => setDeleteConfirmId(null)}
        confirmText="Delete"
        type="danger"
      />

      <ConfirmModal
        isOpen={purgeConfirm}
        title="Purge Demo Users"
        message="This will delete ALL duplicated demo user profiles except the main 'demo_admin_profile'. This is useful for cleaning up training data. Are you sure?"
        onConfirm={handlePurgeDemoUsers}
        onCancel={() => setPurgeConfirm(false)}
        confirmText={isPurging ? "Purging..." : "Purge All"}
        type="danger"
      />

      <header className="bg-white border-b border-[var(--border)] px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Super Admin Console</h1>
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">Global System Control</p>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase">
            <Activity size={12} className="animate-pulse" /> System Live
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('companies')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === 'companies' ? 'bg-white text-[var(--accent)] shadow-sm' : 'text-[var(--text-secondary)]'
            }`}
          >
            <Building2 size={14} /> Companies
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === 'users' ? 'bg-white text-[var(--accent)] shadow-sm' : 'text-[var(--text-secondary)]'
            }`}
          >
            <Users size={14} /> Users
          </button>
          <button
            onClick={() => setActiveTab('health')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === 'health' ? 'bg-white text-[var(--accent)] shadow-sm' : 'text-[var(--text-secondary)]'
            }`}
          >
            <Activity size={14} /> Health
          </button>
          <button
            onClick={() => setActiveTab('infrastructure')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === 'infrastructure' ? 'bg-white text-[var(--accent)] shadow-sm' : 'text-[var(--text-secondary)]'
            }`}
          >
            <Server size={14} /> System
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
        {activeTab !== 'health' && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={18} />
              <input 
                type="text"
                placeholder={activeTab === 'companies' ? "Search companies..." : "Search users..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-[var(--border)] rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all shadow-sm font-medium"
              />
            </div>
            
            {activeTab === 'users' && (
              <button
                onClick={() => setPurgeConfirm(true)}
                disabled={isPurging}
                className="w-full bg-rose-50 text-rose-600 py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-rose-100 transition-colors"
              >
                <UserMinus size={16} />
                {isPurging ? 'Purging Duplicates...' : 'Purge Duplicated Demo Users'}
              </button>
            )}
          </div>
        )}

        <AnimatePresence mode="wait">
          {activeTab === 'companies' && (
            <motion.div 
              key="companies"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              {filteredCompanies.map(company => (
                <div key={company.id} className="google-card p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex gap-3">
                      <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center">
                        <Building2 size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-[var(--text-primary)]">{company.name}</h3>
                        <p className="text-xs text-[var(--text-secondary)]">{company.ownerEmail}</p>
                        <p className="text-[10px] text-[var(--text-secondary)] mt-1">Registered: {new Date(company.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    
                    {company.isApproved ? (
                      <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full text-[10px] font-bold uppercase">
                        <CheckCircle2 size={12} /> Approved
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-amber-600 bg-amber-50 px-3 py-1 rounded-full text-[10px] font-bold uppercase">
                        <Clock size={12} /> Pending
                      </div>
                    )}
                  </div>

                  {company.isApproved ? (
                    <div className="mt-4 pt-4 border-t border-slate-50">
                      <button 
                        onClick={() => disapproveCompany(company.id)}
                        className="w-full bg-rose-50 text-rose-600 py-3 rounded-xl font-bold text-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                        <XCircle size={18} /> Disapprove Registration
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 pt-4 border-t border-slate-50">
                      <button 
                        onClick={() => approveCompany(company.id)}
                        className="w-full bg-[var(--accent)] text-white py-3 rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 size={18} /> Approve Registration
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </motion.div>
          )}

          {activeTab === 'users' && (
            <motion.div 
              key="users"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              {filteredUsers.map(user => (
                <div key={user.uid} className="google-card p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${user.suspended ? 'bg-rose-50 text-rose-400' : 'bg-blue-50 text-[var(--accent)]'}`}>
                        {user.displayName.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-[var(--text-primary)]">{user.displayName}</h3>
                        <p className="text-xs text-[var(--text-secondary)]">{user.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-bold bg-slate-100 text-[var(--text-secondary)] px-2 py-0.5 rounded uppercase">
                            {user.role}
                          </span>
                          <span className="text-[10px] text-[var(--text-secondary)]">
                            {companies.find(c => c.id === user.companyId)?.name || 'No Company'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {user.suspended ? (
                      <div className="flex items-center gap-1 text-rose-600 bg-rose-50 px-3 py-1 rounded-full text-[10px] font-bold uppercase">
                        <ShieldAlert size={12} /> Suspended
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full text-[10px] font-bold uppercase">
                        <ShieldCheck size={12} /> Active
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-50 flex gap-2">
                    <button 
                      onClick={() => toggleUserSuspension(user.uid, !user.suspended)}
                      className={`flex-1 py-3 rounded-xl font-bold text-sm active:scale-95 transition-all flex items-center justify-center gap-2 ${
                        user.suspended 
                          ? 'bg-emerald-50 text-emerald-600' 
                          : 'bg-rose-50 text-rose-600'
                      }`}
                    >
                      {user.suspended ? (
                        <>
                          <ShieldCheck size={18} /> Unsuspend
                        </>
                      ) : (
                        <>
                          <ShieldAlert size={18} /> Suspend
                        </>
                      )}
                    </button>
                    
                    <button 
                      onClick={() => setDeleteConfirmId(user.uid)}
                      className="px-4 bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-50 py-3 rounded-xl font-bold text-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                      title="Delete User"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {activeTab === 'infrastructure' && (
            <motion.div 
              key="infrastructure"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* SMTP Configuration */}
              <div className="google-card p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                    <Database size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-[var(--text-primary)]">System Email Sender (SMTP)</h3>
                    <p className="text-xs text-[var(--text-secondary)]">Technical configuration for sending onboarding emails</p>
                  </div>
                </div>

                <div className="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    <span className="font-bold">Important:</span> This is for the <strong>System Sender Account</strong> only. 
                    Your staff members/users should continue to use the standard password (e.g., <code>welcome@2025</code>) to log in.
                  </p>
                </div>

                {/* Google Auth Domain help */}
                <div className="mb-4 p-4 rounded-xl bg-indigo-50 border border-indigo-100">
                  <h4 className="text-sm font-bold text-indigo-800 mb-2 flex items-center gap-2">
                    <Mail size={16} /> Google Sign-In Setup
                  </h4>
                  <p className="text-[10px] text-indigo-700 leading-relaxed mb-3">
                    If you are having trouble logging in with Google (403 Error), you must add this domain to your Firebase Console:
                  </p>
                  <div className="bg-white/50 p-2 rounded border border-indigo-200 font-mono text-[10px] text-indigo-900 break-all mb-3 select-all">
                    {window.location.hostname}
                  </div>
                  <ol className="text-[10px] text-indigo-700 space-y-1 list-decimal pl-4">
                    <li>Go to <strong>Firebase Console</strong></li>
                    <li>Select <strong>Authentication</strong> &gt; <strong>Settings</strong></li>
                    <li>Click <strong>Authorized domains</strong></li>
                    <li>Click <strong>Add domain</strong> and paste the URL above</li>
                  </ol>
                </div>

                <div className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-2">Test SMTP Settings</label>
                    <div className="flex gap-2">
                      <input 
                        type="email"
                        placeholder="Enter test email address..."
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        className="flex-1 bg-white border border-[var(--border)] rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      />
                      <button
                        onClick={handleTestEmail}
                        disabled={isTestingEmail || !testEmail}
                        className="bg-[var(--accent)] text-white px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center gap-2"
                      >
                        {isTestingEmail ? 'Testing...' : 'Send Test'}
                      </button>
                    </div>
                    {testResult && (
                      <div className={`mt-3 p-3 rounded-lg text-xs font-medium flex items-start gap-2 ${testResult.success ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                        {testResult.success ? <CheckCircle2 size={14} className="shrink-0 mt-0.5" /> : <AlertTriangle size={14} className="shrink-0 mt-0.5" />}
                        <span className="break-all">{testResult.message}</span>
                      </div>
                    )}
                  </div>

                  <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
                    <h4 className="text-sm font-bold text-blue-800 mb-2">Help: Common Issues</h4>
                    <ul className="text-xs text-blue-700 space-y-2 list-disc pl-4">
                      <li><strong>Gmail App Passwords:</strong> You <u>must</u> use an App Password, not your regular Gmail password.</li>
                      <li><strong>Port 587/465:</strong> 587 is standard for TLS. 465 is for SSL.</li>
                      <li><strong>Missing Env Vars:</strong> Ensure <code>SMTP_USER</code> and <code>SMTP_PASS</code> are set in AI Studio Secrets.</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Maintenance Tools */}
              <div className="google-card p-6">
                <h3 className="font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                  <Server size={18} /> System Maintenance
                </h3>
                <div className="space-y-4">
                  <button
                    onClick={() => setPurgeConfirm(true)}
                    disabled={isPurging}
                    className="w-full bg-rose-50 text-rose-600 py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-rose-100 transition-colors"
                  >
                    <UserMinus size={16} />
                    {isPurging ? 'Purging Duplicates...' : 'Purge Duplicated Demo Users'}
                  </button>
                  <p className="text-[10px] text-[var(--text-secondary)] text-center">
                    Use these tools to clean up the database or reset system state.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'health' && (
            <motion.div 
              key="health"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Database Status */}
              <div className="google-card p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-blue-50 text-[var(--accent)] rounded-2xl flex items-center justify-center">
                    <Database size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-[var(--text-primary)]">Firestore Database</h3>
                    <p className="text-xs text-[var(--text-secondary)]">Enterprise Edition • {healthStats.region}</p>
                  </div>
                  <div className="ml-auto flex items-center gap-1 text-emerald-600 font-bold text-xs uppercase">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    {healthStats.dbStatus}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1">Daily Reads</p>
                    <p className="text-xl font-bold text-[var(--text-primary)]">{healthStats.readsToday}</p>
                    <div className="w-full bg-slate-200 h-1 rounded-full mt-2">
                      <div className="bg-blue-500 h-full rounded-full" style={{ width: '15%' }} />
                    </div>
                    <p className="text-[9px] text-[var(--text-secondary)] mt-1">15% of free tier</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1">Daily Writes</p>
                    <p className="text-xl font-bold text-[var(--text-primary)]">{healthStats.writesToday}</p>
                    <div className="w-full bg-slate-200 h-1 rounded-full mt-2">
                      <div className="bg-emerald-500 h-full rounded-full" style={{ width: '8%' }} />
                    </div>
                    <p className="text-[9px] text-[var(--text-secondary)] mt-1">8% of free tier</p>
                  </div>
                </div>
              </div>

              {/* System Infrastructure */}
              <div className="google-card p-6">
                <h3 className="font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                  <Server size={18} /> Infrastructure Overview
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                    <span className="text-sm text-[var(--text-secondary)]">Current Plan</span>
                    <span className="text-sm font-bold text-[var(--accent)]">{healthStats.tier}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                    <span className="text-sm text-[var(--text-secondary)]">Total Companies</span>
                    <span className="text-sm font-bold text-[var(--text-primary)]">{healthStats.totalCompanies}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                    <span className="text-sm text-[var(--text-secondary)]">Total Users</span>
                    <span className="text-sm font-bold text-[var(--text-primary)]">{healthStats.totalUsers}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-[var(--text-secondary)]">Uptime (30d)</span>
                    <span className="text-sm font-bold text-emerald-600">99.98%</span>
                  </div>
                </div>
              </div>

              {/* Warnings / Alerts */}
              <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex gap-4">
                <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-amber-800 text-sm">Optimization Suggestion</h4>
                  <p className="text-xs text-amber-700 leading-relaxed mt-1">
                    You are currently using the Spark plan. Consider upgrading to Blaze if you plan to onboard more than 10 companies to ensure uninterrupted service.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {activeTab !== 'health' && (
          <div className="text-center py-6">
            <p className="text-slate-400 font-medium text-xs">
              Showing {activeTab === 'companies' ? filteredCompanies.length : filteredUsers.length} results
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
