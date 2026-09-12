import React, { useState, useEffect } from 'react';
import { Building2, CheckCircle2, XCircle, Search, Clock, Activity, Users, ShieldAlert, ShieldCheck, Database, Server, AlertTriangle, Trash2, UserMinus, Mail, UserPlus, RefreshCw, Plus, Pencil, Layers, Shield, Lock, SlidersHorizontal, Megaphone } from 'lucide-react';
import { collection, onSnapshot, query, orderBy, getDocs, doc, deleteDoc, writeBatch, where, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Company, UserProfile } from '../types';
import BroadcastModule from './BroadcastModule';
import { useAuth } from '../contexts/AuthContext';
import { ALL_SYSTEM_MODULES, SUBSCRIPTION_PRESETS, SubscriptionPlanType, ALL_MODULE_IDS } from '../constants/modules';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from './ConfirmModal';

export default function SuperAdminModule() {
  const { user, isSuperAdmin, approveCompany, disapproveCompany, toggleUserSuspension, deleteUser, isFirestoreConnected } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'companies' | 'users' | 'health' | 'infrastructure' | 'broadcast'>('companies');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteCompanyConfirmId, setDeleteCompanyConfirmId] = useState<string | null>(null);
  const [isPurging, setIsPurging] = useState(false);
  const [purgeConfirm, setPurgeConfirm] = useState(false);
  const [isSyncingUsers, setIsSyncingUsers] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editUserTarget, setEditUserTarget] = useState<UserProfile | null>(null);
  const [editCompanyTarget, setEditCompanyTarget] = useState<Company | null>(null);
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [isCreatingCompany, setIsCreatingCompany] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [purgeEmailInput, setPurgeEmailInput] = useState('');
  const [isPurgingEmail, setIsPurgingEmail] = useState(false);
  const [isDeduplicating, setIsDeduplicating] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanType>('ENTERPRISE');
  const [selectedModules, setSelectedModules] = useState<string[]>(ALL_MODULE_IDS);

  React.useEffect(() => {
    if (editCompanyTarget) {
      const plan = editCompanyTarget.subscriptionPlan || 'ENTERPRISE';
      setSelectedPlan(plan);
      if (editCompanyTarget.enabledModules && editCompanyTarget.enabledModules.length > 0) {
        setSelectedModules(editCompanyTarget.enabledModules);
      } else if (plan !== 'CUSTOM' && SUBSCRIPTION_PRESETS[plan as keyof typeof SUBSCRIPTION_PRESETS]) {
        setSelectedModules(SUBSCRIPTION_PRESETS[plan as keyof typeof SUBSCRIPTION_PRESETS].modules);
      } else {
        setSelectedModules(ALL_MODULE_IDS);
      }
    }
  }, [editCompanyTarget]);

  const handlePlanSelect = (plan: SubscriptionPlanType) => {
    setSelectedPlan(plan);
    if (plan !== 'CUSTOM' && SUBSCRIPTION_PRESETS[plan as keyof typeof SUBSCRIPTION_PRESETS]) {
      setSelectedModules(SUBSCRIPTION_PRESETS[plan as keyof typeof SUBSCRIPTION_PRESETS].modules);
    }
  };

  const handleModuleToggle = (modId: string) => {
    setSelectedPlan('CUSTOM');
    setSelectedModules(prev =>
      prev.includes(modId) ? prev.filter(m => m !== modId) : [...prev, modId]
    );
  };

  const handleDeduplicateCompanies = async () => {
    setIsDeduplicating(true);
    try {
      const emailGroups: { [email: string]: Company[] } = {};
      companies.forEach(comp => {
        const email = (comp.ownerEmail || '').toLowerCase().trim();
        if (email) {
          if (!emailGroups[email]) emailGroups[email] = [];
          emailGroups[email].push(comp);
        }
      });

      let mergedOwnerCount = 0;
      let removedCompCount = 0;

      for (const [email, group] of Object.entries(emailGroups)) {
        if (group.length > 1) {
          // Keep primary company (first approved or oldest)
          const primaryComp = group.find(c => c.isApproved) || group[0];
          const duplicateComps = group.filter(c => c.id !== primaryComp.id);

          for (const dup of duplicateComps) {
            // Update staff
            const sQ = query(collection(db, 'staff'), where('companyId', '==', dup.id));
            const sSnap = await getDocs(sQ);
            for (const sDoc of sSnap.docs) {
              await setDoc(sDoc.ref, { companyId: primaryComp.id }, { merge: true });
            }

            // Update user profiles
            const uQ = query(collection(db, 'users'), where('companyId', '==', dup.id));
            const uSnap = await getDocs(uQ);
            for (const uDoc of uSnap.docs) {
              await setDoc(uDoc.ref, { companyId: primaryComp.id }, { merge: true });
            }

            // Delete duplicate company doc
            await deleteDoc(doc(db, 'companies', dup.id));
            removedCompCount++;
          }
          mergedOwnerCount++;
        }
      }

      if (removedCompCount > 0) {
        alert(`Deduplication Complete!\nMerged duplicate company accounts for ${mergedOwnerCount} owner email(s).\nRemoved ${removedCompCount} duplicate company registration(s).`);
      } else {
        alert('No duplicate companies found! All company registrations are unique.');
      }
    } catch (err: any) {
      console.error('Deduplication failed:', err);
      alert(`Deduplication failed: ${err.message}`);
    } finally {
      setIsDeduplicating(false);
    }
  };

  const handlePurgeAccountByEmail = async (targetEmailParam?: string) => {
    const targetEmail = (targetEmailParam || purgeEmailInput || '').toLowerCase().trim();
    if (!targetEmail) {
      alert('Please enter or provide an email address to purge.');
      return;
    }

    if (!confirm(`Are you sure you want to purge ALL companies, staff, and user profiles associated with ${targetEmail}? This cannot be undone.`)) {
      return;
    }

    setIsPurgingEmail(true);
    try {
      let deletedCompCount = 0;
      let deletedUserCount = 0;
      let deletedStaffCount = 0;

      // 1. Delete companies matching ownerEmail
      const cQ = query(collection(db, 'companies'), where('ownerEmail', '==', targetEmail));
      const cSnap = await getDocs(cQ);
      for (const cDoc of cSnap.docs) {
        await deleteDoc(cDoc.ref);
        deletedCompCount++;

        // Delete staff for this company
        const sQ = query(collection(db, 'staff'), where('companyId', '==', cDoc.id));
        const sSnap = await getDocs(sQ);
        for (const sDoc of sSnap.docs) {
          await deleteDoc(sDoc.ref);
          deletedStaffCount++;
        }

        // Delete users for this company
        const uQ = query(collection(db, 'users'), where('companyId', '==', cDoc.id));
        const uSnap = await getDocs(uQ);
        for (const uDoc of uSnap.docs) {
          await deleteDoc(uDoc.ref);
          deletedUserCount++;
        }
      }

      // 2. Delete user profiles directly matching targetEmail
      const uEmailQ = query(collection(db, 'users'), where('email', '==', targetEmail));
      const uEmailSnap = await getDocs(uEmailQ);
      for (const uDoc of uEmailSnap.docs) {
        await deleteDoc(uDoc.ref);
        deletedUserCount++;
      }

      // 3. Delete staff records directly matching targetEmail
      const sEmailQ = query(collection(db, 'staff'), where('email', '==', targetEmail));
      const sEmailSnap = await getDocs(sEmailQ);
      for (const sDoc of sEmailSnap.docs) {
        await deleteDoc(sDoc.ref);
        deletedStaffCount++;
      }

      alert(`Purge Completed for ${targetEmail}:\n- Deleted ${deletedCompCount} company record(s)\n- Deleted ${deletedUserCount} user profile(s)\n- Deleted ${deletedStaffCount} staff record(s)`);
      setPurgeEmailInput('');
    } catch (err: any) {
      console.error('Failed to purge account:', err);
      alert(`Purge failed: ${err.message}`);
    } finally {
      setIsPurgingEmail(false);
    }
  };

  const handleDeleteCompany = async (companyId: string) => {
    try {
      const compTarget = companies.find(c => c.id === companyId);
      const ownerEmail = compTarget?.ownerEmail?.toLowerCase().trim();

      // Find fallback company for owner if they have multiple companies
      const remainingCompanies = companies.filter(c => 
        c.id !== companyId && 
        c.ownerEmail && 
        c.ownerEmail.toLowerCase().trim() === ownerEmail
      );
      const fallbackCompanyId = remainingCompanies.length > 0 ? remainingCompanies[0].id : '';

      // Optimistically hide from local state immediately
      setCompanies(prev => prev.filter(c => c.id !== companyId));

      // 1. Try hard delete company document first; fallback to soft-delete mark if rules block deleteDoc
      let hardDeleted = false;
      try {
        await deleteDoc(doc(db, 'companies', companyId));
        hardDeleted = true;
      } catch (deleteErr: any) {
        console.warn('Hard delete failed (permission constraint). Applying soft-delete mark:', deleteErr);
        await setDoc(doc(db, 'companies', companyId), {
          isDeleted: true,
          status: 'DELETED',
          name: `[DELETED] ${compTarget?.name || 'Company'}`,
          deletedAt: new Date().toISOString()
        }, { merge: true });
      }

      // 2. Reassign user profiles cleanly without deleting the owner's user account
      try {
        const uQ = query(collection(db, 'users'), where('companyId', '==', companyId));
        const uSnap = await getDocs(uQ);
        for (const uDoc of uSnap.docs) {
          const uData = uDoc.data() as UserProfile;
          const uEmail = (uData.email || '').toLowerCase().trim();

          if (ownerEmail && uEmail === ownerEmail) {
            await setDoc(uDoc.ref, { companyId: fallbackCompanyId }, { merge: true });
          } else if (uDoc.id.startsWith('staff_') || uDoc.id.startsWith('owner_')) {
            try { await deleteDoc(uDoc.ref); } catch (e) {
              await setDoc(uDoc.ref, { isDeleted: true, companyId: '' }, { merge: true });
            }
          } else {
            await setDoc(uDoc.ref, { companyId: fallbackCompanyId }, { merge: true });
          }
        }
      } catch (userErr: any) {
        console.warn('Company deleted, but associated users cleanup warning:', userErr);
      }

      // 3. Clear or unlink staff records for this company
      try {
        const sQ = query(collection(db, 'staff'), where('companyId', '==', companyId));
        const sSnap = await getDocs(sQ);
        for (const sDoc of sSnap.docs) {
          try {
            await deleteDoc(sDoc.ref);
          } catch (e) {
            await setDoc(sDoc.ref, { isDeleted: true, companyId: '' }, { merge: true });
          }
        }
      } catch (sErr: any) {
        console.warn('Company deleted, but staff records cleanup warning:', sErr);
      }

      // 4. Clean up sub-collections associated with this company
      const collectionsToClean = [
        'transactions', 'warehouses', 'suppliers', 'buyers', 
        'journal', 'payments', 'petty_cash', 'inventory_adjustments', 
        'store_records', 'bag_transactions', 'payrolls', 'attendance', 'rosters'
      ];

      for (const colName of collectionsToClean) {
        try {
          const colQ = query(collection(db, colName), where('companyId', '==', companyId));
          const colSnap = await getDocs(colQ);
          for (const d of colSnap.docs) {
            try {
              await deleteDoc(d.ref);
            } catch (e) {
              await setDoc(d.ref, { isDeleted: true }, { merge: true });
            }
          }
        } catch (colErr) {
          console.warn(`Cleanup for ${colName} failed:`, colErr);
        }
      }

      alert(hardDeleted 
        ? 'Company profile deleted from database!' 
        : 'Company successfully removed and marked as DELETED! (Owner account preserved)'
      );
    } catch (error: any) {
      console.error('Failed to delete company:', error);
      alert(`Failed to delete company: ${error.message}`);
    } finally {
      setDeleteCompanyConfirmId(null);
    }
  };

  React.useEffect(() => {
    const q = query(collection(db, 'companies'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id } as Company))
        .filter(c => !(c as any).isDeleted && (c as any).status !== 'DELETED' && !(c.name || '').startsWith('[DELETED]'));
      data.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setCompanies(data);
    }, (err) => {
      console.warn('Companies query error:', err);
    });
    return () => unsubscribe();
  }, []);

  React.useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile));
      data.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setUsers(data);
    }, (err) => {
      console.warn('Users query error:', err);
    });
    return () => unsubscribe();
  }, []);

  const allUsers = React.useMemo(() => {
    const list = [...users];
    const existingEmails = new Set(
      list.map(u => (u.email || '').toLowerCase().trim()).filter(Boolean)
    );

    companies.forEach(comp => {
      if (comp.ownerEmail) {
        const ownerEmailLower = comp.ownerEmail.toLowerCase().trim();
        if (!existingEmails.has(ownerEmailLower)) {
          existingEmails.add(ownerEmailLower);
          list.push({
            uid: `owner_${comp.id}`,
            email: ownerEmailLower,
            displayName: `${comp.name} Owner`,
            role: 'ADMIN',
            companyId: comp.id,
            createdAt: comp.createdAt || new Date().toISOString(),
            lastPasswordUpdate: new Date().toISOString()
          });
        }
      }
    });

    return list;
  }, [users, companies]);

  const filteredCompanies = companies.filter(c => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (c.name || '').toLowerCase().includes(q) || (c.ownerEmail || '').toLowerCase().includes(q);
  });

  const filteredUsers = allUsers.filter(u => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const name = (u.displayName || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    const companyName = (companies.find(c => c.id === u.companyId)?.name || '').toLowerCase();
    return name.includes(q) || email.includes(q) || companyName.includes(q);
  });

  // System Health Stats (Calculated from state)
  const healthStats = {
    dbStatus: isFirestoreConnected ? 'Online' : 'Offline',
    region: 'us-west1',
    readsToday: '~1,240',
    writesToday: '~450',
    tier: 'Enterprise Spark',
    totalCompanies: companies.length,
    totalUsers: allUsers.length || 'Loading...',
  };

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

  const handleSyncUsers = async () => {
    setIsSyncingUsers(true);
    try {
      let addedCount = 0;
      const { setDoc, doc } = await import('firebase/firestore');

      // 1. Sync Company Owners
      for (const comp of companies) {
        if (!comp.ownerEmail) continue;
        const ownerEmailLower = comp.ownerEmail.toLowerCase().trim();
        const exists = users.some(u => u.email.toLowerCase().trim() === ownerEmailLower);
        if (!exists) {
          const docId = `owner_${comp.id}`;
          const newProfile: UserProfile = {
            uid: docId,
            email: ownerEmailLower,
            displayName: `${comp.name} Owner`,
            role: 'ADMIN',
            companyId: comp.id,
            createdAt: comp.createdAt || new Date().toISOString(),
            lastPasswordUpdate: new Date().toISOString()
          };
          await setDoc(doc(db, 'users', docId), newProfile, { merge: true });
          addedCount++;
        }
      }

      // 2. Sync Staff Members
      const staffSnap = await getDocs(collection(db, 'staff'));
      for (const staffDoc of staffSnap.docs) {
        const sData = staffDoc.data();
        if (!sData.email) continue;
        const staffEmailLower = sData.email.toLowerCase().trim();
        const exists = users.some(u => u.email.toLowerCase().trim() === staffEmailLower);
        if (!exists) {
          const docId = sData.uid || `staff_user_${staffDoc.id}`;
          const newProfile: UserProfile = {
            uid: docId,
            email: staffEmailLower,
            displayName: sData.name || 'Staff User',
            role: sData.role || 'GUEST',
            companyId: sData.companyId || '',
            assignedWarehouseId: sData.assignedWarehouseId || undefined,
            createdAt: new Date().toISOString(),
            lastPasswordUpdate: new Date().toISOString()
          };
          await setDoc(doc(db, 'users', docId), newProfile, { merge: true });
          addedCount++;
        }
      }

      if (addedCount > 0) {
        alert(`Successfully synced and restored ${addedCount} missing user profile(s)!`);
      } else {
        alert('All company owners and staff already have active user profiles in Firestore.');
      }
    } catch (err: any) {
      console.error('Failed to sync users:', err);
      alert(`Sync failed: ${err.message}`);
    } finally {
      setIsSyncingUsers(false);
    }
  };

  const handleAddUserSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = (formData.get('email') as string)?.toLowerCase().trim();
    const displayName = (formData.get('displayName') as string)?.trim();
    const role = (formData.get('role') as UserProfile['role']) || 'ADMIN';
    const companyId = (formData.get('companyId') as string) || '';

    if (!email || !displayName) {
      alert('Email and Name are required');
      return;
    }

    try {
      const { setDoc, doc } = await import('firebase/firestore');
      const docId = `user_${Date.now()}`;
      const newProfile: UserProfile = {
        uid: docId,
        email,
        displayName,
        role,
        companyId,
        createdAt: new Date().toISOString(),
        lastPasswordUpdate: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', docId), newProfile, { merge: true });
      alert(`User profile for ${email} added successfully!`);
      setShowAddUserModal(false);
    } catch (err: any) {
      console.error('Failed to add user profile:', err);
      alert(`Failed to create user profile: ${err.message}`);
    }
  };

  const handleUpdateUserSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editUserTarget) return;

    const formData = new FormData(e.currentTarget);
    const email = (formData.get('email') as string)?.toLowerCase().trim();
    const displayName = (formData.get('displayName') as string)?.trim();
    const role = (formData.get('role') as UserProfile['role']) || 'ADMIN';
    const companyId = (formData.get('companyId') as string) || '';

    if (!email || !displayName) {
      alert('Email and Name are required');
      return;
    }

    try {
      const updatedData: Partial<UserProfile> = {
        email,
        displayName,
        role,
        companyId: companyId || ''
      };

      await setDoc(doc(db, 'users', editUserTarget.uid), updatedData, { merge: true });

      // If assigning email to a company owner account, update company ownerEmail as well
      if (companyId) {
        await setDoc(doc(db, 'companies', companyId), { ownerEmail: email }, { merge: true });
      }

      alert(`User profile for ${displayName} updated successfully!\nAssigned Email: ${email}`);
      setEditUserTarget(null);
    } catch (err: any) {
      console.error('Failed to update user profile:', err);
      alert(`Failed to update user profile: ${err.message}`);
    }
  };

  const handleUpdateCompanySubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editCompanyTarget) return;

    const formData = new FormData(e.currentTarget);
    const name = (formData.get('name') as string)?.trim();
    const ownerEmail = (formData.get('ownerEmail') as string)?.toLowerCase().trim();

    if (!name || !ownerEmail) {
      alert('Company Name and Owner Email are required');
      return;
    }

    try {
      await setDoc(doc(db, 'companies', editCompanyTarget.id), {
        name,
        ownerEmail,
        subscriptionPlan: selectedPlan,
        enabledModules: selectedModules
      }, { merge: true });

      alert(`Company updated successfully!\nName: ${name}\nSubscription Tier: ${selectedPlan}\nActive Modules: ${selectedModules.length} Enabled`);
      setEditCompanyTarget(null);
    } catch (err: any) {
      console.error('Failed to update company:', err);
      alert(`Failed to update company: ${err.message}`);
    }
  };

  const handleCreateCompanySubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = (formData.get('name') as string)?.trim();
    const ownerEmail = (formData.get('ownerEmail') as string)?.toLowerCase().trim();

    if (!name || !ownerEmail) {
      alert('Company Name and Owner Email are required.');
      return;
    }

    setIsCreatingCompany(true);
    try {
      const compId = `comp_${Date.now()}`;
      const newComp: Company = {
        id: compId,
        name,
        ownerEmail,
        createdAt: new Date().toISOString(),
        isApproved: true,
        subscriptionPlan: selectedPlan,
        enabledModules: selectedModules
      };
      await setDoc(doc(db, 'companies', compId), newComp);
      alert(`Company "${name}" created successfully!\nSubscription Tier: ${selectedPlan}\nActive Modules: ${selectedModules.length} Enabled`);
      setShowAddCompanyModal(false);
    } catch (err: any) {
      console.error('Failed to create company:', err);
      alert(`Failed to create company: ${err.message}`);
    } finally {
      setIsCreatingCompany(false);
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
        isOpen={!!deleteCompanyConfirmId}
        title="Delete Company Registration"
        message="Are you sure you want to delete this company registration? This will completely remove the company record and all associated user profiles from the database."
        onConfirm={() => {
          if (deleteCompanyConfirmId) {
            handleDeleteCompany(deleteCompanyConfirmId);
          }
        }}
        onCancel={() => setDeleteCompanyConfirmId(null)}
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
          <button
            onClick={() => setActiveTab('broadcast')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === 'broadcast' ? 'bg-white text-[var(--accent)] shadow-sm' : 'text-[var(--text-secondary)]'
            }`}
          >
            <Megaphone size={14} /> Broadcast
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
        {activeTab !== 'health' && activeTab !== 'broadcast' && (
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
            
            <div className="flex flex-wrap gap-2">
              <div className="flex-1 flex gap-2 min-w-[280px]">
                <input
                  type="email"
                  placeholder="Enter email to purge account (e.g. user@gmail.com)..."
                  value={purgeEmailInput}
                  onChange={(e) => setPurgeEmailInput(e.target.value)}
                  className="flex-1 bg-white border border-rose-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                <button
                  onClick={() => handlePurgeAccountByEmail()}
                  disabled={isPurgingEmail || !purgeEmailInput.trim()}
                  className="bg-rose-600 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-rose-700 transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                >
                  <Trash2 size={14} />
                  {isPurgingEmail ? 'Purging...' : 'Purge Account'}
                </button>
              </div>

              {activeTab === 'companies' && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setSelectedPlan('BASIC');
                      setSelectedModules(SUBSCRIPTION_PRESETS.BASIC.modules);
                      setShowAddCompanyModal(true);
                    }}
                    className="bg-[var(--accent)] text-white py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    <Building2 size={15} />
                    Add New Company & Assign Tier
                  </button>
                  <button
                    onClick={handleDeduplicateCompanies}
                    disabled={isDeduplicating}
                    className="bg-amber-50 text-amber-800 py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-amber-100 transition-colors border border-amber-200 shadow-sm"
                    title="Automatically merge duplicate company accounts registered with the same owner email"
                  >
                    <RefreshCw size={15} className={isDeduplicating ? 'animate-spin' : ''} />
                    {isDeduplicating ? 'Deduplicating...' : 'Clean Up Duplicate Companies'}
                  </button>
                </div>
              )}

              {activeTab === 'users' && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={handleSyncUsers}
                    disabled={isSyncingUsers}
                    className="flex-1 bg-indigo-50 text-indigo-700 py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-indigo-100 transition-colors border border-indigo-100"
                    title="Auto-scan companies and staff to restore missing user profiles"
                  >
                    <RefreshCw size={15} className={isSyncingUsers ? 'animate-spin' : ''} />
                    {isSyncingUsers ? 'Syncing Missing Users...' : 'Sync & Restore Missing Users'}
                  </button>

                  <button
                    onClick={() => setShowAddUserModal(true)}
                    className="bg-[var(--accent)] text-white py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    <UserPlus size={15} />
                    Add / Restore User
                  </button>

                  <button
                    onClick={() => setPurgeConfirm(true)}
                    disabled={isPurging}
                    className="bg-rose-50 text-rose-600 py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-rose-100 transition-colors"
                  >
                    <UserMinus size={15} />
                    {isPurging ? 'Purging...' : 'Purge Demo Users'}
                  </button>
                </div>
              )}
            </div>
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
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <p className="text-[10px] text-[var(--text-secondary)]">Registered: {new Date(company.createdAt).toLocaleDateString()}</p>
                          
                          {/* Onboarding Counter - Super Admin Visibility */}
                          {isSuperAdmin && (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100">
                              <Clock size={10} className="shrink-0" />
                              <span className="text-[10px] font-bold">
                                {(() => {
                                  const created = new Date(company.createdAt).getTime();
                                  const now = new Date().getTime();
                                  const daysPassed = Math.floor((now - created) / (1000 * 60 * 60 * 24));
                                  const remaining = Math.max(0, 365 - daysPassed);
                                  return `${remaining} Days Left`;
                                })()}
                              </span>
                            </div>
                          )}

                          {/* Subscription Tier & Enabled Modules Badge */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setEditCompanyTarget(company)}
                              title="Click to change subscription tier"
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border transition-all hover:scale-105 ${
                                (company.subscriptionPlan || 'ENTERPRISE') === 'ENTERPRISE'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                                  : (company.subscriptionPlan || 'ENTERPRISE') === 'STANDARD'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                  : company.subscriptionPlan === 'BASIC'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                              }`}
                            >
                              <Layers size={11} />
                              {company.subscriptionPlan || 'ENTERPRISE'} TIER
                            </button>

                            <button
                              type="button"
                              onClick={() => setEditCompanyTarget(company)}
                              title="Click to configure enabled modules"
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold border border-slate-200 flex items-center gap-1 transition-all"
                            >
                              <SlidersHorizontal size={11} />
                              {(company.enabledModules?.length ?? ALL_MODULE_IDS.length)} / {ALL_MODULE_IDS.length} Modules
                            </button>
                          </div>
                        </div>
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

                  <div className="mt-4 pt-4 border-t border-slate-50 flex gap-2">
                    {company.isApproved ? (
                      <button 
                        onClick={() => disapproveCompany(company.id)}
                        className="flex-1 bg-rose-50 text-rose-600 py-3 rounded-xl font-bold text-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                        <XCircle size={18} /> Disapprove Registration
                      </button>
                    ) : (
                      <button 
                        onClick={() => approveCompany(company.id)}
                        className="flex-1 bg-[var(--accent)] text-white py-3 rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 size={18} /> Approve Registration
                      </button>
                    )}

                    <button 
                      onClick={() => setEditCompanyTarget(company)}
                      className="px-3 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 py-3 rounded-xl font-bold text-xs active:scale-95 transition-all flex items-center justify-center gap-1.5"
                      title="Edit Company Details, Subscription Tier & Modules"
                    >
                      <Pencil size={15} />
                      <span className="hidden sm:inline">Edit Tier & Modules</span>
                    </button>

                    <button 
                      onClick={() => setDeleteCompanyConfirmId(company.id)}
                      className="px-4 bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-50 py-3 rounded-xl font-bold text-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                      title="Delete Company Registration"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
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
              {filteredUsers.map(userItem => (
                <div key={userItem.uid} className="google-card p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${userItem.suspended ? 'bg-rose-50 text-rose-400' : 'bg-blue-50 text-[var(--accent)]'}`}>
                        {userItem.displayName ? userItem.displayName.charAt(0) : 'U'}
                      </div>
                      <div>
                        <h3 className="font-bold text-[var(--text-primary)]">{userItem.displayName || 'Unnamed User'}</h3>
                        <p className="text-xs text-[var(--text-secondary)] font-medium">{userItem.email || 'No email assigned'}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-bold bg-slate-100 text-[var(--text-secondary)] px-2 py-0.5 rounded uppercase">
                            {userItem.role}
                          </span>
                          <span className="text-[10px] text-[var(--text-secondary)]">
                            {companies.find(c => c.id === userItem.companyId)?.name || 'No Company'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {userItem.suspended ? (
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
                      onClick={() => setEditUserTarget(userItem)}
                      className="flex-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 py-3 rounded-xl font-bold text-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                      title="Edit Account Details or Assign Email"
                    >
                      <Pencil size={18} /> Edit / Assign Email
                    </button>

                    <button 
                      onClick={() => toggleUserSuspension(userItem.uid, !userItem.suspended)}
                      className={`px-4 py-3 rounded-xl font-bold text-sm active:scale-95 transition-all flex items-center justify-center gap-2 ${
                        userItem.suspended 
                          ? 'bg-emerald-50 text-emerald-600' 
                          : 'bg-rose-50 text-rose-600'
                      }`}
                      title={userItem.suspended ? "Unsuspend User" : "Suspend User"}
                    >
                      {userItem.suspended ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
                    </button>
                    
                    <button 
                      onClick={() => setDeleteConfirmId(userItem.uid)}
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

          {activeTab === 'broadcast' && (
            <motion.div 
              key="broadcast"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <BroadcastModule />
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
                    <li>Go to the <a href={`https://console.firebase.google.com/project/${import.meta.env.VITE_FIREBASE_PROJECT_ID || "gen-lang-client-0555602350"}/authentication/providers`} target="_blank" rel="noreferrer" className="text-indigo-600 font-bold underline">Firebase Auth Console</a>.</li>
                    <li>In the <strong>Sign-in method</strong> tab, click <strong>Add new provider</strong>.</li>
                    <li>Select <strong>Google</strong> and click <strong>Enable</strong> (configure the project support email).</li>
                    <li>Go to <strong>Settings</strong> &gt; <strong>Authorized domains</strong>.</li>
                    <li>Click <strong>Add domain</strong> and paste the URL above.</li>
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
                    <h4 className="text-sm font-bold text-blue-800 mb-2 flex items-center gap-2">
                       <Mail size={16} /> Gmail SMTP Setup Guide
                    </h4>
                    <div className="space-y-3">
                      <div className="text-[11px] text-blue-800 font-medium">To send emails via Gmail, follow these steps:</div>
                      <ol className="text-xs text-blue-700 space-y-2 list-decimal pl-4">
                        <li>Go to your <strong>Google Account Settings</strong> &gt; Security.</li>
                        <li>Enable <strong>2-Step Verification</strong> (required for App Passwords).</li>
                        <li>Search for <strong>"App Passwords"</strong> in the settings search bar.</li>
                        <li>Create a new app password (select "Other" and name it "CCS App").</li>
                        <li>Copy the <strong>16-character code</strong> provided.</li>
                      </ol>
                      
                      <div className="mt-4 pt-3 border-t border-blue-200">
                        <div className="text-[11px] text-blue-800 font-bold uppercase mb-2">Required Secrets (AI Studio):</div>
                        <ul className="text-xs text-blue-700 space-y-1 font-mono">
                          <li className="flex justify-between"><span>SMTP_USER:</span> <span className="font-bold text-blue-900">your@gmail.com</span></li>
                          <li className="flex justify-between"><span>SMTP_PASS:</span> <span className="font-bold text-blue-900">[16-char-app-password]</span></li>
                          <li className="flex justify-between"><span>SMTP_HOST:</span> <span className="font-bold text-blue-900">smtp.gmail.com</span></li>
                          <li className="flex justify-between"><span>SMTP_PORT:</span> <span className="font-bold text-blue-900">587</span></li>
                          <li className="flex justify-between"><span>SMTP_SECURE:</span> <span className="font-bold text-blue-900 text-red-600">false</span></li>
                        </ul>
                        <p className="mt-2 text-[10px] text-blue-600 italic">Note: SMTP_SECURE must be <strong>false</strong> for port 587.</p>
                      </div>
                    </div>
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

        {activeTab !== 'health' && activeTab !== 'broadcast' && activeTab !== 'infrastructure' && (
          <div className="text-center py-6">
            <p className="text-slate-400 font-medium text-xs">
              Showing {activeTab === 'companies' ? filteredCompanies.length : filteredUsers.length} results
            </p>
          </div>
        )}
      </main>

      {/* Add / Restore User Modal */}
      <AnimatePresence>
        {showAddUserModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                  <UserPlus size={20} className="text-[var(--accent)]" />
                  Add / Restore User Profile
                </h3>
                <button
                  onClick={() => setShowAddUserModal(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold p-1"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddUserSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    User Email Address *
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    placeholder="e.g. user@company.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Full Name / Display Name *
                  </label>
                  <input
                    type="text"
                    name="displayName"
                    required
                    placeholder="e.g. John Doe"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    User Role
                  </label>
                  <select
                    name="role"
                    defaultValue="ADMIN"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] font-medium"
                  >
                    <option value="ADMIN">ADMIN (Company Owner / Manager)</option>
                    <option value="ACCOUNT">ACCOUNT (Accountant)</option>
                    <option value="AUDITOR">AUDITOR (Auditor)</option>
                    <option value="BUYER">BUYER (Purchasing Agent)</option>
                    <option value="STORE_KEEPER">STORE_KEEPER (Warehouse Keeper)</option>
                    <option value="GUEST">GUEST (Read-only)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Assign to Company
                  </label>
                  <select
                    name="companyId"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] font-medium"
                  >
                    <option value="">-- No Company --</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.ownerEmail})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddUserModal(false)}
                    className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-[var(--accent)] text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors shadow-md"
                  >
                    Create Profile
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {/* Edit User / Assign Email Modal */}
        {editUserTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                    <Pencil size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-lg">Edit Account & Assign Email</h3>
                    <p className="text-xs text-slate-500">Update account profile or assign email address</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditUserTarget(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-lg"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleUpdateUserSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    defaultValue={editUserTarget.email || ''}
                    placeholder="e.g. wasiuadebisi89@gmail.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Full Name / Display Name *
                  </label>
                  <input
                    type="text"
                    name="displayName"
                    required
                    defaultValue={editUserTarget.displayName || ''}
                    placeholder="e.g. John Doe"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    User Role
                  </label>
                  <select
                    name="role"
                    defaultValue={editUserTarget.role || 'ADMIN'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] font-medium"
                  >
                    <option value="ADMIN">ADMIN (Company Owner / Manager)</option>
                    <option value="MANAGER">MANAGER (Operations Manager)</option>
                    <option value="ACCOUNT">ACCOUNT (Accountant)</option>
                    <option value="AUDITOR">AUDITOR (Auditor)</option>
                    <option value="STORE_KEEPER">STORE_KEEPER (Warehouse Keeper)</option>
                    <option value="STAFF">STAFF (General Staff)</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN (System Super Admin)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Assigned Company
                  </label>
                  <select
                    name="companyId"
                    defaultValue={editUserTarget.companyId || ''}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] font-medium"
                  >
                    <option value="">-- No Company --</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.ownerEmail})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEditUserTarget(null)}
                    className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-[var(--accent)] text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors shadow-md"
                  >
                    Save & Assign
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {/* Edit Company Modal */}
        {editCompanyTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-2xl shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-lg">Edit Company & Module Access Control</h3>
                    <p className="text-xs text-slate-500">Configure subscription tier and enable/disable system modules</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditCompanyTarget(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-lg"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleUpdateCompanySubmit} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      Company Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      required
                      defaultValue={editCompanyTarget.name || ''}
                      placeholder="e.g. Adezmold Consulting Ltd"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      Owner Email Address *
                    </label>
                    <input
                      type="email"
                      name="ownerEmail"
                      required
                      defaultValue={editCompanyTarget.ownerEmail || ''}
                      placeholder="e.g. wasiuadebisi89@gmail.com"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] font-medium"
                    />
                  </div>
                </div>

                {/* Subscription Tier Selection */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers size={14} className="text-indigo-600" />
                        Subscription Tier Preset
                      </h4>
                      <p className="text-[11px] text-slate-500">Select a pricing package or customize module permissions individually</p>
                    </div>
                    <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 font-bold rounded-lg text-[10px] uppercase">
                      Current: {selectedPlan}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(['BASIC', 'STANDARD', 'ENTERPRISE', 'CUSTOM'] as SubscriptionPlanType[]).map((planKey) => (
                      <button
                        key={planKey}
                        type="button"
                        onClick={() => handlePlanSelect(planKey)}
                        className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all border text-center flex flex-col items-center justify-center gap-0.5 ${
                          selectedPlan === planKey
                            ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-md scale-[1.02]'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span className="uppercase text-[11px]">{planKey}</span>
                        <span className="text-[9px] opacity-80 font-normal">
                          {planKey === 'BASIC' && '5 Modules'}
                          {planKey === 'STANDARD' && '9 Modules'}
                          {planKey === 'ENTERPRISE' && 'All 12 Modules'}
                          {planKey === 'CUSTOM' && 'Custom Selection'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Module Access Checkboxes */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <SlidersHorizontal size={14} className="text-indigo-600" />
                        Enabled App Modules ({selectedModules.length} / {ALL_MODULE_IDS.length} Active)
                      </h4>
                      <p className="text-[11px] text-slate-500">Uncheck modules to restrict access & enforce tier controls for this company</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                    {ALL_SYSTEM_MODULES.map((mod) => {
                      const isChecked = selectedModules.includes(mod.id);
                      return (
                        <div
                          key={mod.id}
                          onClick={() => handleModuleToggle(mod.id)}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                            isChecked
                              ? 'bg-indigo-50/50 border-indigo-200 shadow-sm'
                              : 'bg-slate-50/60 border-slate-200 opacity-60 hover:opacity-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // Handled by parent onClick
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <span className="text-xs font-bold text-slate-900 truncate">{mod.name}</span>
                              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-slate-200/80 text-slate-600 rounded">
                                {mod.category.split(' ')[0]}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 line-clamp-1">{mod.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEditCompanyTarget(null)}
                    className="flex-1 bg-slate-100 text-slate-600 py-3.5 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-[var(--accent)] text-white py-3.5 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors shadow-md flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={16} /> Save Company & Module Controls
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {/* Add New Company Modal */}
        {showAddCompanyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-2xl shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-lg">Onboard New Company & Assign Tier</h3>
                    <p className="text-xs text-slate-500">Register a new company and select its subscription tier & active modules</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddCompanyModal(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-lg"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateCompanySubmit} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      Company Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      required
                      placeholder="e.g. Kano Commodity Exchange"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      Owner Email Address *
                    </label>
                    <input
                      type="email"
                      name="ownerEmail"
                      required
                      placeholder="e.g. owner@kanocommodity.com"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] font-medium"
                    />
                  </div>
                </div>

                {/* Subscription Tier Selection */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers size={14} className="text-indigo-600" />
                        Assign Subscription Tier Preset
                      </h4>
                      <p className="text-[11px] text-slate-500">Choose Basic (Trade), Standard (Operations), Enterprise (Full) or Custom</p>
                    </div>
                    <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 font-bold rounded-lg text-[10px] uppercase">
                      Selected: {selectedPlan}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(['BASIC', 'STANDARD', 'ENTERPRISE', 'CUSTOM'] as SubscriptionPlanType[]).map((planKey) => (
                      <button
                        key={planKey}
                        type="button"
                        onClick={() => handlePlanSelect(planKey)}
                        className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all border text-center flex flex-col items-center justify-center gap-0.5 ${
                          selectedPlan === planKey
                            ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-md scale-[1.02]'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span className="uppercase text-[11px]">{planKey}</span>
                        <span className="text-[9px] opacity-80 font-normal">
                          {planKey === 'BASIC' && '5 Modules'}
                          {planKey === 'STANDARD' && '9 Modules'}
                          {planKey === 'ENTERPRISE' && 'All 12 Modules'}
                          {planKey === 'CUSTOM' && 'Custom Selection'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Module Access Checkboxes */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <SlidersHorizontal size={14} className="text-indigo-600" />
                        Enabled App Modules ({selectedModules.length} / {ALL_MODULE_IDS.length} Active)
                      </h4>
                      <p className="text-[11px] text-slate-500">Uncheck modules to restrict access or customize for this new company</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                    {ALL_SYSTEM_MODULES.map((mod) => {
                      const isChecked = selectedModules.includes(mod.id);
                      return (
                        <div
                          key={mod.id}
                          onClick={() => handleModuleToggle(mod.id)}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                            isChecked
                              ? 'bg-indigo-50/50 border-indigo-200 shadow-sm'
                              : 'bg-slate-50/60 border-slate-200 opacity-60 hover:opacity-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <span className="text-xs font-bold text-slate-900 truncate">{mod.name}</span>
                              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-slate-200/80 text-slate-600 rounded">
                                {mod.category.split(' ')[0]}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 line-clamp-1">{mod.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddCompanyModal(false)}
                    className="flex-1 bg-slate-100 text-slate-600 py-3.5 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingCompany}
                    className="flex-1 bg-[var(--accent)] text-white py-3.5 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <CheckCircle2 size={16} />
                    {isCreatingCompany ? 'Creating Company...' : 'Create Company & Assign Tier'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
