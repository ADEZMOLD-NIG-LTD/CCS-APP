/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Authentication and company membership.
 *
 * The client never decides who someone is: membership, role and company approval come from
 * Firestore documents that only the security rules can grant (see firestore.rules). This
 * context reads them and exposes the resulting access state to the UI.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth, db, initError, isFirebaseConfigured } from '../firebase';
import { collection, doc, getDoc, onSnapshot, query, where } from '../lib/fs';
import { commitWrites, type WriteOp } from '../lib/writes';
import { AuditAction, auditOp, type AuditActor } from '../lib/audit';
import { enterDemoMode, exitDemoMode, isDemoRuntime } from '../lib/runtimeMode';
import { isCompanyRole, roleCan, type CompanyRole, type PermissionAction } from '../lib/permissions';
import {
  DEFAULT_BILLING_CONFIG,
  normalizeBillingConfig,
  subscriptionState as computeSubscriptionState,
  type BillingConfig,
  type SubscriptionState,
} from '../lib/billing';
import { formatFirestoreError } from '../lib/firestore';
import { logger } from '../lib/logger';
import { newId, normalizeEmail } from '../lib/utils';
import { DEMO_COMPANY_ID, DEMO_USER_ID } from '../mockFirebase';
import type { Company, Invite, UserProfile } from '../types';

export type { PermissionAction };

export type AccessState =
  | 'LOADING'
  | 'NOT_CONFIGURED'
  | 'SIGNED_OUT'
  | 'VERIFY_EMAIL'
  | 'NO_COMPANY'
  | 'ACCOUNT_SUSPENDED'
  | 'COMPANY_UNAVAILABLE'
  | 'PENDING_APPROVAL'
  | 'COMPANY_SUSPENDED'
  | 'SUPER_ADMIN_ONLY'
  | 'READY';

export const PASSWORD_MAX_AGE_DAYS = 90;
export const MIN_PASSWORD_LENGTH = 10;

export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Password must contain both letters and numbers.';
  return null;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  company: Company | null;
  ownedCompanies: Company[];
  pendingInvites: Invite[];
  accessState: AccessState;
  loading: boolean;
  isDemoMode: boolean;
  isSuperAdmin: boolean;
  role: CompanyRole | null;
  emailVerified: boolean;
  usesPasswordSignIn: boolean;
  mustChangePassword: boolean;
  auditActor: AuditActor | null;
  can: (action: PermissionAction) => boolean;
  isModuleEnabled: (moduleId: string) => boolean;
  /** Subscription state of the active company. EXPIRED makes it read-only (see lib/billing). */
  subscriptionState: SubscriptionState;
  subscriptionExpiresAt: Date | null;
  isReadOnly: boolean;
  billingConfig: BillingConfig;
  isAdmin: boolean;
  isManager: boolean;
  isOnline: boolean;
  configError: string | null;
  errorMessage: string | null;
  setErrorMessage: (msg: string | null) => void;
  successMessage: string | null;
  setSuccessMessage: (msg: string | null) => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshUser: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  registerCompany: (companyName: string, requestedPlan: 'BASIC' | 'STANDARD' | 'ENTERPRISE') => Promise<void>;
  acceptInvite: (invite: Invite) => Promise<void>;
  switchCompany: (companyId: string) => Promise<void>;
  requestCompanyDeletion: () => Promise<void>;
  enterDemoMode: () => void;
  exitDemoMode: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_USER = {
  uid: DEMO_USER_ID,
  email: 'demo@training.local',
  displayName: 'Training User',
  emailVerified: true,
  providerData: [],
} as unknown as User;

function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code || '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Invalid email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few minutes and try again.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Sign in instead, or reset your password.';
    case 'auth/weak-password':
      return 'That password is too weak.';
    case 'auth/popup-blocked':
      return 'The sign-in popup was blocked. Allow popups for this site and try again.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return '';
    case 'auth/unauthorized-domain':
      return `This domain (${window.location.hostname}) is not authorised for sign-in. Add it in Firebase Console → Authentication → Settings → Authorized domains.`;
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled for the project.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    case 'auth/requires-recent-login':
      return 'For security, please sign in again and retry.';
    case 'auth/not-configured':
      return (error as Error).message;
    default:
      return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(isDemoRuntime ? DEMO_USER : null);
  const [userVersion, setUserVersion] = useState(0);
  const [authReady, setAuthReady] = useState(isDemoRuntime || !auth);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [company, setCompany] = useState<Company | null>(null);
  const [companyLoaded, setCompanyLoaded] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [superAdminLoaded, setSuperAdminLoaded] = useState(false);
  const [ownedByUid, setOwnedByUid] = useState<Company[]>([]);
  const [ownedByEmail, setOwnedByEmail] = useState<Company[]>([]);
  const [pendingInvites, setPendingInvites] = useState<Invite[]>([]);
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const autoConnectAttempted = useRef<string | null>(null);
  const passwordStampAttempted = useRef<string | null>(null);

  const emailVerified = isDemoRuntime || !!user?.emailVerified;
  const email = normalizeEmail(user?.email);
  const usesPasswordSignIn = !isDemoRuntime && !!user?.providerData?.some(p => p.providerId === 'password');

  // ------------------------------------------------------------ connectivity
  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, []);

  // ------------------------------------------------------------ auth state
  useEffect(() => {
    if (isDemoRuntime || !auth) return;
    return onAuthStateChanged(auth, firebaseUser => {
      setUser(firebaseUser);
      setAuthReady(true);
    });
  }, []);

  const uid = user?.uid ?? null;

  // ------------------------------------------------------------ profile + platform admin
  useEffect(() => {
    setProfile(null);
    setProfileLoaded(false);
    setIsSuperAdmin(false);
    setSuperAdminLoaded(false);
    if (!uid) return;

    const unsubscribe = onSnapshot(
      doc(db, 'users', uid),
      snapshot => {
        setProfile(snapshot.exists() ? ({ ...(snapshot.data() as UserProfile), uid: snapshot.id }) : null);
        setProfileLoaded(true);
      },
      error => {
        logger.error('Profile subscription failed', error);
        setProfile(null);
        setProfileLoaded(true);
        setErrorMessage(formatFirestoreError(error));
      }
    );

    if (isDemoRuntime) {
      setSuperAdminLoaded(true);
    } else {
      getDoc(doc(db, 'platform_admins', uid))
        .then(snapshot => setIsSuperAdmin(snapshot.exists()))
        .catch(() => setIsSuperAdmin(false))
        .finally(() => setSuperAdminLoaded(true));
    }

    return unsubscribe;
  }, [uid]);

  // ------------------------------------------------------------ owned companies & invites
  useEffect(() => {
    setOwnedByUid([]);
    setOwnedByEmail([]);
    setPendingInvites([]);
    if (!uid || isDemoRuntime) return;

    const unsubscribers: Array<() => void> = [];
    const toCompanies = (docs: { id: string; data: () => unknown }[]) =>
      docs.map(d => ({ ...(d.data() as Company), id: d.id })).filter(c => !c.isDeleted && c.status !== 'DELETED');

    unsubscribers.push(onSnapshot(
      query(collection(db, 'companies'), where('ownerUid', '==', uid)),
      snapshot => setOwnedByUid(toCompanies(snapshot.docs)),
      error => logger.warn('Owned companies query failed', error)
    ));

    if (emailVerified && email) {
      unsubscribers.push(onSnapshot(
        query(collection(db, 'companies'), where('ownerEmail', '==', email)),
        snapshot => setOwnedByEmail(toCompanies(snapshot.docs)),
        error => logger.warn('Legacy owned companies query failed', error)
      ));
      unsubscribers.push(onSnapshot(
        query(collection(db, 'invites'), where('email', '==', email), where('status', '==', 'PENDING')),
        snapshot => setPendingInvites(snapshot.docs.map(d => ({ ...(d.data() as Invite), id: d.id }))),
        error => logger.warn('Invites query failed', error)
      ));
    }

    return () => unsubscribers.forEach(fn => fn());
  }, [uid, email, emailVerified, userVersion]);

  const ownedCompanies = useMemo(() => {
    const byId = new Map<string, Company>();
    [...ownedByUid, ...ownedByEmail].forEach(c => byId.set(c.id, c));
    return [...byId.values()].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [ownedByUid, ownedByEmail]);

  // ------------------------------------------------------------ active company
  const companyId = profile?.companyId || '';
  useEffect(() => {
    setCompany(null);
    setCompanyLoaded(false);
    if (!companyId) return;
    return onSnapshot(
      doc(db, 'companies', companyId),
      snapshot => {
        setCompany(snapshot.exists() ? ({ ...(snapshot.data() as Company), id: snapshot.id }) : null);
        setCompanyLoaded(true);
      },
      error => {
        logger.warn('Company subscription failed', error);
        setCompany(null);
        setCompanyLoaded(true);
      }
    );
  }, [companyId]);

  // ------------------------------------------------------------ derived access state
  const profileIsActive = !!profile && (profile.status ?? 'ACTIVE') === 'ACTIVE' && profile.suspended !== true;
  const role: CompanyRole | null = profile && isCompanyRole(profile.role) ? profile.role : null;

  const accessState: AccessState = useMemo(() => {
    if (!isDemoRuntime && !isFirebaseConfigured) return 'NOT_CONFIGURED';
    if (!authReady) return 'LOADING';
    if (!user) return 'SIGNED_OUT';
    if (!profileLoaded || !superAdminLoaded) return 'LOADING';
    if (!profile && usesPasswordSignIn && !emailVerified) return 'VERIFY_EMAIL';
    if (profile && profile.suspended === true) return 'ACCOUNT_SUSPENDED';
    if (!profile || !profile.companyId) return isSuperAdmin ? 'SUPER_ADMIN_ONLY' : 'NO_COMPANY';
    if (!profileIsActive) return isSuperAdmin ? 'SUPER_ADMIN_ONLY' : 'ACCOUNT_SUSPENDED';
    if (!companyLoaded) return 'LOADING';
    if (!company || company.isDeleted || company.status === 'DELETED') return isSuperAdmin ? 'SUPER_ADMIN_ONLY' : 'COMPANY_UNAVAILABLE';
    if (company.status === 'SUSPENDED') return isSuperAdmin ? 'SUPER_ADMIN_ONLY' : 'COMPANY_SUSPENDED';
    if (company.isApproved !== true || company.status === 'PENDING') return isSuperAdmin ? 'SUPER_ADMIN_ONLY' : 'PENDING_APPROVAL';
    return 'READY';
  }, [authReady, user, profileLoaded, superAdminLoaded, profile, usesPasswordSignIn, emailVerified, isSuperAdmin, profileIsActive, companyLoaded, company]);

  const mustChangePassword = useMemo(() => {
    if (accessState !== 'READY' || !usesPasswordSignIn || !profile) return false;
    if (profile.mustChangePassword) return true;
    if (!profile.lastPasswordUpdate) return false;
    const ageDays = (Date.now() - new Date(profile.lastPasswordUpdate).getTime()) / 86_400_000;
    return ageDays >= PASSWORD_MAX_AGE_DAYS;
  }, [accessState, usesPasswordSignIn, profile]);

  const auditActor: AuditActor | null = useMemo(
    () => (accessState === 'READY' && profile && user ? { companyId: profile.companyId, uid: user.uid, email: normalizeEmail(user.email) || profile.email } : null),
    [accessState, profile, user]
  );

  // ------------------------------------------------------------ subscription
  const [billingConfig, setBillingConfig] = useState<BillingConfig>(DEFAULT_BILLING_CONFIG);

  useEffect(() => {
    if (!user) {
      setBillingConfig(DEFAULT_BILLING_CONFIG);
      return undefined;
    }
    return onSnapshot(
      doc(db, 'platform_config', 'billing'),
      snapshot => setBillingConfig(normalizeBillingConfig(snapshot.exists() ? snapshot.data() : null)),
      error => logger.warn('Billing prices unavailable', error)
    );
  }, [user]);

  const subscriptionExpiresAt = useMemo(() => {
    const raw = company?.subscriptionExpiresAt;
    if (!raw) return null;
    if (typeof raw === 'string') {
      const parsed = new Date(raw);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return typeof raw.toDate === 'function' ? raw.toDate() : null;
  }, [company]);

  const subscriptionState = useMemo(
    () => computeSubscriptionState(subscriptionExpiresAt, new Date(), billingConfig.graceDays),
    [subscriptionExpiresAt, billingConfig.graceDays]
  );
  const isReadOnly = subscriptionState === 'EXPIRED';

  const can = useCallback(
    (action: PermissionAction) => {
      if (accessState !== 'READY' || !roleCan(role, action)) return false;
      // An unpaid company keeps full read access; the rules refuse its writes either way.
      if (isReadOnly && !action.startsWith('view_')) return false;
      return true;
    },
    [accessState, role, isReadOnly]
  );

  const isModuleEnabled = useCallback(
    (moduleId: string) => {
      if (!company) return false;
      if (!company.enabledModules || company.enabledModules.length === 0) return true;
      return company.enabledModules.includes(moduleId);
    },
    [company]
  );

  // Start the password-age clock for email/password users who have never had it recorded.
  useEffect(() => {
    if (isDemoRuntime || accessState !== 'READY' || !usesPasswordSignIn || !profile || profile.lastPasswordUpdate) return;
    if (passwordStampAttempted.current === profile.uid) return;
    passwordStampAttempted.current = profile.uid;
    commitWrites([{ kind: 'update', collection: 'users', id: profile.uid, data: { lastPasswordUpdate: new Date().toISOString(), updatedAt: new Date().toISOString() } }])
      .catch(error => logger.warn('Could not record password date', error));
  }, [accessState, usesPasswordSignIn, profile]);

  // ------------------------------------------------------------ actions
  const signInWithGoogle = useCallback(async () => {
    if (!auth) return;
    setErrorMessage(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (error) {
      const message = authErrorMessage(error);
      if (message) setErrorMessage(message);
    }
  }, []);

  const signInWithEmail = useCallback(async (rawEmail: string, password: string) => {
    if (!auth) return;
    setErrorMessage(null);
    try {
      await signInWithEmailAndPassword(auth, normalizeEmail(rawEmail), password);
    } catch (error) {
      setErrorMessage(authErrorMessage(error));
    }
  }, []);

  const signUpWithEmail = useCallback(async (rawEmail: string, password: string, name: string) => {
    if (!auth) return;
    setErrorMessage(null);
    const problem = passwordProblem(password);
    if (problem) {
      setErrorMessage(problem);
      return;
    }
    try {
      const credential = await createUserWithEmailAndPassword(auth, normalizeEmail(rawEmail), password);
      if (name.trim()) await updateProfile(credential.user, { displayName: name.trim() });
      await sendEmailVerification(credential.user, { url: window.location.origin });
      setSuccessMessage('Account created. We sent a verification link to your email — open it, then come back and continue.');
    } catch (error) {
      setErrorMessage(authErrorMessage(error));
    }
  }, []);

  const resendVerificationEmail = useCallback(async () => {
    if (!auth?.currentUser) return;
    try {
      await sendEmailVerification(auth.currentUser, { url: window.location.origin });
      setSuccessMessage('Verification email sent. Check your inbox and spam folder.');
    } catch (error) {
      setErrorMessage(authErrorMessage(error));
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (!auth?.currentUser) return;
    try {
      await reload(auth.currentUser);
      // Force a fresh ID token so the security rules see the updated email_verified claim.
      await auth.currentUser.getIdToken(true);
      setUser(auth.currentUser);
      setUserVersion(v => v + 1);
      if (!auth.currentUser.emailVerified) setErrorMessage('Your email is not verified yet. Open the link in the verification email first.');
    } catch (error) {
      setErrorMessage(authErrorMessage(error));
    }
  }, []);

  const resetPassword = useCallback(async (rawEmail: string) => {
    if (!auth) return;
    setErrorMessage(null);
    const target = normalizeEmail(rawEmail);
    if (!target.includes('@')) {
      setErrorMessage('Enter a valid email address.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, target, { url: window.location.origin });
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code !== 'auth/user-not-found' && code !== 'auth/invalid-email') {
        setErrorMessage(authErrorMessage(error));
        return;
      }
    }
    // Same message whether or not the account exists, to avoid revealing registered emails.
    setSuccessMessage('If an account exists for that email, a password reset link has been sent. Use the most recent email you receive.');
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const current = auth?.currentUser;
    if (!current || !current.email || !profile) throw new Error('Not signed in.');
    const problem = passwordProblem(newPassword);
    if (problem) throw new Error(problem);
    try {
      await reauthenticateWithCredential(current, EmailAuthProvider.credential(current.email, currentPassword));
      await updatePassword(current, newPassword);
      await current.getIdToken(true);
      await commitWrites([{
        kind: 'update',
        collection: 'users',
        id: current.uid,
        data: { lastPasswordUpdate: new Date().toISOString(), mustChangePassword: false, updatedAt: new Date().toISOString() },
      }]);
      setSuccessMessage('Password updated.');
    } catch (error) {
      const code = (error as { code?: string })?.code;
      const message = code === 'auth/wrong-password' || code === 'auth/invalid-credential' ? 'Your current password is incorrect.' : code?.startsWith('auth/') ? authErrorMessage(error) : formatFirestoreError(error);
      throw new Error(message);
    }
  }, [profile]);

  const logout = useCallback(async () => {
    if (isDemoRuntime) {
      exitDemoMode();
      return;
    }
    if (!auth) return;
    try {
      await signOut(auth);
      setSuccessMessage(null);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(authErrorMessage(error));
    }
  }, []);

  const profileWrite = useCallback(
    (fields: { companyId: string; role: CompanyRole; assignedWarehouseId?: string | null; inviteId?: string }, mode: 'owner' | 'invite'): WriteOp => {
      const nowIso = new Date().toISOString();
      if (!user) throw new Error('Not signed in.');
      if (!profile) {
        return {
          kind: 'set',
          collection: 'users',
          id: user.uid,
          data: {
            uid: user.uid,
            email,
            displayName: user.displayName || email.split('@')[0] || 'User',
            role: fields.role,
            companyId: fields.companyId,
            assignedWarehouseId: fields.assignedWarehouseId ?? null,
            status: 'ACTIVE',
            createdAt: nowIso,
            lastPasswordUpdate: nowIso,
            ...(fields.inviteId ? { inviteId: fields.inviteId } : {}),
          },
        };
      }
      const data: Record<string, unknown> = {
        companyId: fields.companyId,
        role: fields.role,
        assignedWarehouseId: fields.assignedWarehouseId ?? null,
        status: 'ACTIVE',
        updatedAt: nowIso,
      };
      if (mode === 'invite') data.inviteId = fields.inviteId;
      return { kind: 'update', collection: 'users', id: user.uid, data };
    },
    [user, profile, email]
  );

  const registerCompany = useCallback(async (companyName: string, requestedPlan: 'BASIC' | 'STANDARD' | 'ENTERPRISE') => {
    if (!user) return;
    setErrorMessage(null);
    const name = companyName.trim();
    if (name.length < 2) {
      setErrorMessage('Enter your company name.');
      return;
    }
    if (!emailVerified) {
      setErrorMessage('Verify your email address before registering a company.');
      return;
    }
    const id = `comp_${newId()}`;
    try {
      await commitWrites([
        {
          kind: 'set',
          collection: 'companies',
          id,
          data: { id, name, ownerUid: user.uid, ownerEmail: email, createdAt: new Date().toISOString(), isApproved: false, status: 'PENDING', requestedPlan },
        },
        profileWrite({ companyId: id, role: 'ADMIN' }, 'owner'),
      ]);
      setSuccessMessage('Company registered. A platform administrator will review and activate it.');
    } catch (error) {
      setErrorMessage(formatFirestoreError(error));
    }
  }, [user, emailVerified, email, profileWrite]);

  const acceptInvite = useCallback(async (invite: Invite) => {
    if (!user) return;
    setErrorMessage(null);
    try {
      const nowIso = new Date().toISOString();
      await commitWrites([
        { kind: 'update', collection: 'invites', id: invite.id, data: { status: 'ACCEPTED', acceptedAt: nowIso, acceptedByUid: user.uid } },
        profileWrite({ companyId: invite.companyId, role: invite.role, assignedWarehouseId: invite.assignedWarehouseId ?? null, inviteId: invite.id }, 'invite'),
      ]);
      // Linking the staff record is best-effort: the membership above is what grants access.
      if (invite.staffId) {
        commitWrites([{ kind: 'update', collection: 'staff', id: invite.staffId, data: { uid: user.uid } }])
          .catch(error => logger.warn('Could not link staff record', error));
      }
      setSuccessMessage(`You have joined ${invite.companyName}.`);
    } catch (error) {
      setErrorMessage(formatFirestoreError(error));
    }
  }, [user, profileWrite]);

  const switchCompany = useCallback(async (targetCompanyId: string) => {
    if (!user) return;
    setErrorMessage(null);
    const target = ownedCompanies.find(c => c.id === targetCompanyId);
    if (!target) {
      setErrorMessage('You can only connect to companies you own.');
      return;
    }
    try {
      const ops: WriteOp[] = [];
      if (!target.ownerUid) {
        ops.push({ kind: 'update', collection: 'companies', id: target.id, data: { ownerUid: user.uid } });
      }
      ops.push(profileWrite({ companyId: target.id, role: 'ADMIN' }, 'owner'));
      await commitWrites(ops);
      setSuccessMessage(`Connected to ${target.name}.`);
    } catch (error) {
      setErrorMessage(formatFirestoreError(error));
    }
  }, [user, ownedCompanies, profileWrite]);

  const requestCompanyDeletion = useCallback(async () => {
    if (!company || !auditActor || role !== 'ADMIN') return;
    try {
      const nowIso = new Date().toISOString();
      await commitWrites([
        { kind: 'update', collection: 'companies', id: company.id, data: { deletionRequestedAt: nowIso, updatedAt: nowIso } },
        auditOp(auditActor, { action: AuditAction.UPDATE, module: 'Company', recordId: company.id, details: `Requested deletion of company ${company.name}` }),
      ]);
      setSuccessMessage('Deletion request sent to the platform administrator.');
    } catch (error) {
      setErrorMessage(formatFirestoreError(error));
    }
  }, [company, auditActor, role]);

  // Legacy owners and single-company owners are connected automatically after sign-in.
  useEffect(() => {
    if (isDemoRuntime || !user || !profileLoaded || !emailVerified) return;
    if (profile && profile.companyId) return;
    if (ownedCompanies.length !== 1 || pendingInvites.length > 0) return;
    if (autoConnectAttempted.current === user.uid) return;
    autoConnectAttempted.current = user.uid;
    switchCompany(ownedCompanies[0].id);
  }, [user, profileLoaded, emailVerified, profile, ownedCompanies, pendingInvites, switchCompany]);

  const value: AuthContextType = {
    user,
    profile,
    company,
    ownedCompanies,
    pendingInvites,
    accessState,
    loading: accessState === 'LOADING',
    isDemoMode: isDemoRuntime,
    isSuperAdmin,
    role,
    emailVerified,
    usesPasswordSignIn,
    mustChangePassword,
    auditActor,
    can,
    isModuleEnabled,
    subscriptionState,
    subscriptionExpiresAt,
    isReadOnly,
    billingConfig,
    isAdmin: accessState === 'READY' && role === 'ADMIN',
    isManager: accessState === 'READY' && (role === 'ADMIN' || role === 'MANAGER'),
    isOnline,
    configError: initError,
    errorMessage,
    setErrorMessage,
    successMessage,
    setSuccessMessage,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resendVerificationEmail,
    refreshUser,
    resetPassword,
    changePassword,
    logout,
    registerCompany,
    acceptInvite,
    switchCompany,
    requestCompanyDeletion,
    enterDemoMode,
    exitDemoMode,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export { DEMO_COMPANY_ID };
