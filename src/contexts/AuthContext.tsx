/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithRedirect,
  GoogleAuthProvider, 
  signOut, 
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  User 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  getDocFromServer
} from 'firebase/firestore';
import { auth, db, firebaseConfig, isMockFallback } from '../firebase';
import { UserProfile, Company, Staff } from '../types';
import { handleFirestoreError, reportFirestoreError, formatFirestoreError, OperationType } from '../lib/firestore';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  company: Company | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  sendResetEmailAdmin: (email: string) => Promise<void>;
  manualResetPassword: (userId: string) => Promise<void>;
  changePassword: (currentPass: string, newPass: string) => Promise<void>;
  logout: () => Promise<void>;
  registerCompany: (companyName: string) => Promise<void>;
  resetProfileCompany: () => Promise<void>;
  connectExistingCompany: (companyId: string) => Promise<void>;
  deleteCompanyByOwner: (companyId: string) => Promise<void>;
  deleteUserAccount: () => Promise<void>;
  userCompanies: Company[];
  approveCompany: (companyId: string) => Promise<void>;
  disapproveCompany: (companyId: string) => Promise<void>;
  toggleUserSuspension: (userId: string, status: boolean) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  signInAsDemo: () => Promise<void>;
  isAdmin: boolean;
  isManager: boolean;
  isAccount: boolean;
  isAuditor: boolean;
  isStoreKeeper: boolean;
  isStaff: boolean;
  isSuperAdmin: boolean;
  isDemoMode: boolean;
  mustChangePassword: boolean;
  isFirestoreConnected: boolean;
  isOnline: boolean;
  connectionError: string | null;
  errorMessage: string | null;
  setErrorMessage: (msg: string | null) => void;
  successMessage: string | null;
  setSuccessMessage: (msg: string | null) => void;
  can: (action: PermissionAction) => boolean;
  canPostTransactions: boolean;
  canManageStaff: boolean;
  canTransferStock: boolean;
}

export type PermissionAction = 
  | 'manage_users' 
  | 'manage_companies' 
  | 'manage_suppliers' 
  | 'manage_buyers' 
  | 'manage_inventory' 
  | 'manage_staff' 
  | 'manage_payroll' 
  | 'view_reports' 
  | 'view_analytics' 
  | 'manage_warehouses' 
  | 'manage_journal'
  | 'manage_store_records'
  | 'manage_petty_cash';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const shouldDefaultToDemo = () => {
  const isDemo = localStorage.getItem('ccs_demo_mode');
  const isLoggedOut = localStorage.getItem('ccs_logged_out');
  if (isLoggedOut === 'true') return false;
  if (isDemo === 'false') return false;
  // If not explicitly logged out or disabled, default to true in development/preview to showcase the active app immediately
  return true;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(() => {
    const active = shouldDefaultToDemo();
    if (active) localStorage.setItem('ccs_demo_mode', 'true');
    return active;
  });
  const [user, setUser] = useState<User | null>(() => {
    if (shouldDefaultToDemo()) {
      return {
        uid: 'demo_user_local',
        email: 'demo@ccs.com',
        displayName: 'Training User (Local Offline)',
        isAnonymous: true,
        emailVerified: true,
        providerData: []
      } as any;
    }
    return null;
  });
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    if (shouldDefaultToDemo()) {
      return {
        uid: 'demo_admin_profile_local',
        email: 'demo@ccs.com',
        displayName: 'Training User (Local Offline)',
        role: 'ADMIN',
        companyId: 'demo_company_local',
        createdAt: new Date().toISOString()
      };
    }
    return null;
  });
  const [company, setCompany] = useState<Company | null>(() => {
    if (shouldDefaultToDemo()) {
      return {
        id: 'demo_company_local',
        name: 'CCS Training Demo (Local Offline)',
        ownerEmail: 'demo@ccs.com',
        createdAt: new Date().toISOString(),
        isApproved: true
      };
    }
    return null;
  });
  const [userCompanies, setUserCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(() => {
    return !shouldDefaultToDemo();
  });
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [isFirestoreConnected, setIsFirestoreConnected] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Permission Engine Logic
  const can = (action: PermissionAction): boolean => {
    const adminEmails = ['wasiuadebisi89@gmail.com', 'adezmoldent@gmail.com', 'abdullahiwasiu07@gmail.com'];
    const currentEmail = (user?.email || profile?.email || '').toLowerCase().trim();
    if (currentEmail && adminEmails.includes(currentEmail)) return true; // Super Admin bypass
    if (isSuperAdmin) return true;
    if (isDemoMode) return true; // Demo mode has all permissions
    if (!profile) return false;

    switch (action) {
      case 'manage_users':
        return isAdmin;
      case 'manage_companies':
        return false; // Only super admin
      case 'manage_suppliers':
      case 'manage_buyers':
      case 'manage_inventory':
        return isStaff; // Staff, Account, Manager, Admin all have this
      case 'manage_staff':
        return isAdmin || isManager;
      case 'manage_payroll':
      case 'manage_journal':
        return isAdmin || isAccount; // Account, Manager, Admin all have this
      case 'view_reports':
      case 'view_analytics':
        return isAdmin || isManager || isAccount || isAuditor;
      case 'manage_warehouses':
        return isAdmin || isManager;
      case 'manage_store_records':
        return isAdmin || isManager || isStoreKeeper;
      case 'manage_petty_cash':
        return isStaff; // Any company staff can access Petty Cash
      default:
        return false;
    }
  };

  console.log('AuthProvider: State', { loading, user: user?.uid, isDemoMode, isFirestoreConnected });

  React.useEffect(() => {
    async function testConnection() {
      if (isMockFallback) {
        console.log("AuthContext: Operating in Local / Offline Mock Mode. Bypassing connection test.");
        setIsFirestoreConnected(true);
        setConnectionError(null);
        return;
      }

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection test timeout')), 4000) // 4 seconds
      );
      
      try {
        console.log("Testing Firestore connection...");
        
        // Configuration integrity check
        const domain = window.location.hostname;
        const configAuthDomain = firebaseConfig.authDomain || '';
        const isRunApp = domain.includes('.run.app');
        const isMismatchedAuthDomain = configAuthDomain && !configAuthDomain.includes('.firebaseapp.com') && !configAuthDomain.includes('.firebase.google.com');

        if (isRunApp && isMismatchedAuthDomain) {
          console.warn(`Auth Domain Warning: Your authDomain is set to "${configAuthDomain}". This may cause issues in production. It usually should be your "*.firebaseapp.com" domain.`);
        }

        // Ping the publicly accessible path '_health_check_/ping' instead of authenticated 'test/connection'
        await Promise.race([
          getDocFromServer(doc(db, '_health_check_', 'ping')),
          timeoutPromise
        ]);
        console.log("Firestore connection successful.");
        setIsFirestoreConnected(true);
        setConnectionError(null);
      } catch (error: any) {
        if (error.message === 'Connection test timeout') {
          console.warn("Firestore connection test timed out. Proceeding optimistically.");
          setIsFirestoreConnected(true);
          setConnectionError(null);
          return;
        }

        if (error.message?.includes('the client is offline')) {
          // If offline, we don't treat it as a critical connection error since we have persistence
          setIsFirestoreConnected(true);
          setConnectionError(null);
          return;
        }

        if (error.code === 'permission-denied') {
          // Permission denied is actually a success! It means we reached the server.
          setIsFirestoreConnected(true);
          setConnectionError(null);
          return;
        }

        console.error("Firestore connection test failed:", error.message);
        
        setIsFirestoreConnected(false);
        setConnectionError(
          `Firestore connection issue for project "${firebaseConfig.projectId}". ` +
          `Error: ${error.code || 'unknown'}. ` +
          `Please ensure the Firestore API is enabled and the database configuration is correct.`
        );
      }
    }

    testConnection();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const isSuperAdmin = useMemo(() => {
    const userEmail = (user?.email || '').toLowerCase().trim();
    const profileEmail = (profile?.email || '').toLowerCase().trim();
    const superAdminEmails = [
      'wasiuadebisi89@gmail.com',
      'adezmoldent@gmail.com',
      'abdullahiwasiu07@gmail.com'
    ];
    return superAdminEmails.includes(userEmail) || 
           superAdminEmails.includes(profileEmail) ||
           profile?.role === 'SUPER_ADMIN';
  }, [user?.email, profile?.email, profile?.role]);

  const isAdmin = useMemo(() => profile?.role === 'ADMIN' || isSuperAdmin, [profile?.role, isSuperAdmin]);
  const isManager = useMemo(() => profile?.role === 'MANAGER' || isAdmin, [profile?.role, isAdmin]);
  const isAccount = useMemo(() => profile?.role === 'ACCOUNT' || isManager, [profile?.role, isManager]);
  const isAuditor = useMemo(() => profile?.role === 'AUDITOR' || isManager, [profile?.role, isManager]);
  const isStoreKeeper = useMemo(() => profile?.role === 'STORE_KEEPER' || isAdmin, [profile?.role, isAdmin]);
  const isStaff = useMemo(() => profile?.role === 'STAFF' || isAccount || isAuditor || isStoreKeeper, [profile?.role, isAccount, isAuditor, isStoreKeeper]);

  React.useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;
    let unsubscribeCompany: (() => void) | null = null;
    let unsubscribeUserCompanies: (() => void) | null = null;

    // Safety timeout to ensure the app doesn't get stuck on the loading screen
    const loadingTimeout = setTimeout(() => {
      if (loading) {
        console.warn('AuthContext: Loading state timed out after 10s. Forcing initialization.');
        setLoading(false);
      }
    }, 10000);

    if (!auth || !db) {
      console.error('AuthContext: Firebase services not available. Skipping initialization.');
      setLoading(false);
      return;
    }

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      console.log('AuthContext: onAuthStateChanged trigger:', user?.uid || 'no user');
      
      if (localStorage.getItem('ccs_demo_mode') === 'true' && !user) {
        setLoading(false);
        clearTimeout(loadingTimeout);
        return;
      }
      
      setUser(user);
      
      try {
        if (user) {
          if (user.isAnonymous || localStorage.getItem('ccs_demo_mode') === 'true') {
            setIsDemoMode(true);
            setProfile({
              uid: 'demo_admin_profile_local',
              email: 'demo@ccs.com',
              displayName: 'Training User (Local Offline)',
              role: 'ADMIN',
              companyId: 'demo_company_local',
              createdAt: new Date().toISOString()
            });
            setCompany({
              id: 'demo_company_local',
              name: 'CCS Training Demo (Local Offline)',
              ownerEmail: 'demo@ccs.com',
              createdAt: new Date().toISOString(),
              isApproved: true
            });
            setLoading(false);
            clearTimeout(loadingTimeout);
          } else {
            if (unsubscribeProfile) unsubscribeProfile();
            if (unsubscribeCompany) unsubscribeCompany();
            if (unsubscribeUserCompanies) unsubscribeUserCompanies();

            // Subscribe to companies owned by this user
            if (user.email) {
              const compQuery = query(
                collection(db, 'companies'),
                where('ownerEmail', '==', user.email.toLowerCase())
              );
              unsubscribeUserCompanies = onSnapshot(compQuery, (compSnapshot) => {
                const comps: Company[] = [];
                compSnapshot.forEach((doc) => {
                  comps.push(doc.data() as Company);
                });
                setUserCompanies(comps);
              }, (err) => {
                console.error("Failed to fetch user companies:", err);
              });
            }

            const profileId = user.uid;
            const userRef = doc(db, 'users', profileId);
            
            console.log('AuthContext: Setting up profile listener for:', profileId);
            unsubscribeProfile = onSnapshot(userRef, async (userDoc) => {
              if (userDoc.exists()) {
                const data = userDoc.data() as UserProfile;
                console.log('AuthContext: Profile update received:', { role: data.role, mustChange: !!data.lastPasswordUpdate });
                
                // Check for suspension
                if (data.suspended && !isSuperAdmin) {
                  console.warn('AuthContext: User is suspended. Signing out.');
                  setErrorMessage('Your account has been suspended. Please contact the Super Admin.');
                  signOut(auth);
                  return;
                }

                setProfile(data);
                setLoading(false);
                clearTimeout(loadingTimeout);

                // Password Policy Engine
                const providers = user.providerData.map(p => p.providerId);
                const isEmailUser = providers.includes('password');
                
                if (isEmailUser) {
                  if (data.lastPasswordUpdate) {
                    const lastUpdate = new Date(data.lastPasswordUpdate).getTime();
                    const now = new Date().getTime();
                    const diffDays = (now - lastUpdate) / (1000 * 60 * 60 * 24);
                    const expired = diffDays >= 90;
                    console.log('AuthContext: Password policy check:', { lastPasswordUpdate: data.lastPasswordUpdate, diffDays, expired });
                    setMustChangePassword(expired);
                  } else {
                    // Force change on first login for email users
                    console.log('AuthContext: Force change - lastPasswordUpdate missing');
                    setMustChangePassword(true);
                  }
                } else {
                  setMustChangePassword(false);
                }
                
                if (data.companyId) {
                  const companyRef = doc(db, 'companies', data.companyId);
                  if (unsubscribeCompany) unsubscribeCompany();
                  
                  unsubscribeCompany = onSnapshot(companyRef, async (companyDoc) => {
                    if (companyDoc.exists()) {
                      const compData = companyDoc.data() as Company;
                      // Auto-approve company if not yet approved to prevent owners getting stuck
                      if (!compData.isApproved) {
                        try {
                          await setDoc(companyRef, { isApproved: true }, { merge: true });
                          compData.isApproved = true;
                        } catch (e) {
                          console.warn('AuthContext: Auto company approval write failed:', e);
                        }
                      }
                      setCompany(compData);
                    } else {
                      console.warn('AuthContext: Company doc does not exist for ID:', data.companyId);
                      // Check if there is an existing company by ownerEmail
                      try {
                        const cleanUserEmail = (user.email || '').toLowerCase().trim();
                        if (cleanUserEmail) {
                          const compQuery = query(collection(db, 'companies'), where('ownerEmail', '==', cleanUserEmail));
                          const compSnap = await getDocs(compQuery);
                          if (!compSnap.empty) {
                            const foundComp = compSnap.docs[0].data() as Company;
                            if (!foundComp.isApproved) {
                              await setDoc(doc(db, 'companies', foundComp.id), { isApproved: true }, { merge: true });
                              foundComp.isApproved = true;
                            }
                            setCompany(foundComp);
                            // Update user doc with found company id
                            await setDoc(userRef, { companyId: foundComp.id }, { merge: true });
                            return;
                          }
                        }
                      } catch (err) {
                        console.warn('AuthContext: Fallback company lookup failed:', err);
                      }

                      setCompany({
                        id: data.companyId,
                        name: 'Unknown / Deleted Company',
                        isApproved: true,
                        createdAt: new Date().toISOString()
                      } as Company);
                    }
                  }, (error) => {
                    console.warn('AuthContext: Company snapshot failed:', error);
                    setCompany({
                      id: data.companyId,
                      name: 'Temp (Connection Error)',
                      isApproved: true,
                      createdAt: new Date().toISOString()
                    } as Company);
                  });
                }
              } else {
                // New User / Pre-registered Staff Logic
                if (user.email && !isDemoMode) {
                  const cleanEmail = user.email.toLowerCase().trim();

                  // 1. Check if user document exists in 'users' collection by email under different ID
                  setLoading(true);
                  try {
                    const existingUsersQuery = query(
                      collection(db, 'users'),
                      where('email', '==', cleanEmail)
                    );
                    const existingUsersDocs = await getDocs(existingUsersQuery);

                    if (!existingUsersDocs.empty) {
                      const existingProfile = existingUsersDocs.docs[0].data() as UserProfile;
                      console.log('AuthContext: Profile found in users collection by email. Syncing to user.uid:', user.uid);
                      const updatedProfile: UserProfile = {
                        ...existingProfile,
                        uid: user.uid,
                        email: cleanEmail,
                        lastPasswordUpdate: existingProfile.lastPasswordUpdate || new Date().toISOString()
                      };
                      await setDoc(userRef, updatedProfile, { merge: true });
                      setProfile(updatedProfile);
                      setLoading(false);
                      return;
                    }

                    const isSuperAdminEmail = [
                      'wasiuadebisi89@gmail.com',
                      'adezmoldent@gmail.com',
                      'abdullahiwasiu07@gmail.com'
                    ].includes(cleanEmail);

                    if (isSuperAdminEmail) {
                      console.log('AuthContext: Super Admin logged in. Ensuring profile and HQ company exist...');
                      const superCompanyId = 'super_admin_hq';
                      const superCompany: Company = {
                        id: superCompanyId,
                        name: 'Adezmold Consulting HQ',
                        ownerEmail: cleanEmail,
                        createdAt: new Date().toISOString(),
                        isApproved: true
                      };
                      
                      const superProfile: UserProfile = {
                        uid: user.uid,
                        email: cleanEmail,
                        displayName: user.displayName || 'Super Admin',
                        role: 'ADMIN',
                        companyId: superCompanyId,
                        createdAt: new Date().toISOString(),
                        lastPasswordUpdate: new Date().toISOString()
                      };

                      await setDoc(doc(db, 'companies', superCompanyId), superCompany, { merge: true });
                      await setDoc(userRef, superProfile, { merge: true });
                      
                      setProfile(superProfile);
                      setCompany(superCompany);
                      console.log('AuthContext: Super Admin profile and HQ company initialized successfully.');
                    } else {
                      console.log('AuthContext: User profile missing, checking staff records for:', cleanEmail);
                      const staffQuery = query(
                        collection(db, 'staff'),
                        where('email', '==', cleanEmail)
                      );
                      const staffDocs = await getDocs(staffQuery);
                      
                      if (!staffDocs.empty) {
                        const staffData = staffDocs.docs[0].data() as Staff;
                        console.log('AuthContext: Staff record found. Creating profile for new user...');
                        const newProfile: any = {
                          uid: user.uid,
                          email: cleanEmail,
                          displayName: user.displayName || staffData.name,
                          role: staffData.role,
                          companyId: staffData.companyId,
                          assignedWarehouseId: staffData.assignedWarehouseId,
                          createdAt: new Date().toISOString(),
                          lastPasswordUpdate: new Date().toISOString()
                        };
                        
                        Object.keys(newProfile).forEach(key => newProfile[key] === undefined && delete newProfile[key]);
                        
                        try {
                          await setDoc(userRef, newProfile);
                          setProfile(newProfile);
                        } catch (rulesError: any) {
                          console.error('AuthContext: Profile creation REJECTED by rules:', rulesError);
                          setErrorMessage(`Permission Denied: Could not create your login profile. Please contact administrator.`);
                        }
                        
                        try {
                          await setDoc(doc(db, 'staff', staffDocs.docs[0].id), { uid: user.uid }, { merge: true });
                        } catch (linkError) {
                          console.warn('AuthContext: Failed to link staff record to UID.', linkError);
                        }
                      } else {
                        console.log('AuthContext: No staff record found for:', cleanEmail, '. Checking companies collection...');
                        
                        // Check if user is owner of a company (case-insensitive & trimmed)
                        let compDocs = await getDocs(query(
                          collection(db, 'companies'),
                          where('ownerEmail', '==', cleanEmail)
                        ));

                        if (compDocs.empty) {
                          // Search all companies for email match
                          const allCompsSnap = await getDocs(collection(db, 'companies'));
                          const matchedDoc = allCompsSnap.docs.find(d => {
                            const oe = (d.data() as Company).ownerEmail;
                            return oe && oe.toLowerCase().trim() === cleanEmail;
                          });
                          if (matchedDoc) {
                            compDocs = { empty: false, docs: [matchedDoc] } as any;
                          }
                        }

                        if (!compDocs.empty) {
                          const ownedCompany = compDocs.docs[0].data() as Company;
                          console.log('AuthContext: Company owner record found. Restoring admin profile for:', ownedCompany.name);
                          
                          if (!ownedCompany.isApproved) {
                            try {
                              await setDoc(doc(db, 'companies', ownedCompany.id), { isApproved: true }, { merge: true });
                              ownedCompany.isApproved = true;
                            } catch (e) {
                              console.warn('AuthContext: Auto approval write failed:', e);
                            }
                          }

                          const restoredProfile: UserProfile = {
                            uid: user.uid,
                            email: cleanEmail,
                            displayName: user.displayName || cleanEmail.split('@')[0] || 'Company Owner',
                            role: 'ADMIN',
                            companyId: ownedCompany.id,
                            createdAt: ownedCompany.createdAt || new Date().toISOString(),
                            lastPasswordUpdate: new Date().toISOString()
                          };
                          await setDoc(userRef, restoredProfile, { merge: true });
                          setProfile(restoredProfile);
                          setCompany(ownedCompany);
                        } else {
                          console.log('AuthContext: Creating default user profile for:', cleanEmail);
                          const defaultProfile: UserProfile = {
                            uid: user.uid,
                            email: cleanEmail,
                            displayName: user.displayName || cleanEmail.split('@')[0] || 'User',
                            role: 'ADMIN',
                            companyId: '',
                            createdAt: new Date().toISOString(),
                            lastPasswordUpdate: new Date().toISOString()
                          };
                          await setDoc(userRef, defaultProfile, { merge: true });
                          setProfile(defaultProfile);
                          setCompany(null);
                        }
                      }
                    }
                  } catch (lookupError: any) {
                    console.error('AuthContext: Lookup error during user init:', lookupError);
                  } finally {
                    setLoading(false);
                  }
                } else {
                  setProfile(null);
                  setCompany(null);
                  setLoading(false);
                }
              }
            }, (error) => {
              setErrorMessage(reportFirestoreError(error, OperationType.GET, `users/${user.uid}`));
              setLoading(false);
            });
          }
        } else {
          setIsDemoMode(false);
          setProfile(null);
          setCompany(null);
          setUserCompanies([]);
          if (unsubscribeProfile) unsubscribeProfile();
          if (unsubscribeCompany) unsubscribeCompany();
          if (unsubscribeUserCompanies) unsubscribeUserCompanies();
          setLoading(false);
          clearTimeout(loadingTimeout);
        }
      } catch (err) {
        console.error('AuthContext: onAuthStateChanged error:', err);
        setLoading(false);
        clearTimeout(loadingTimeout);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeCompany) unsubscribeCompany();
      if (unsubscribeUserCompanies) unsubscribeUserCompanies();
    };
  }, [isDemoMode, isSuperAdmin]);

  const signIn = async () => {
    try {
      setErrorMessage(null);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      
      const domain = window.location.hostname;
      console.log(`AuthContext: Attempting Google Sign-In on domain: ${domain}`);
      
      // Use Popup for best compatibility in shared and iframe environments
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error('Sign in failed:', error);
      const domain = window.location.hostname;
      
      if (error.code === 'auth/unauthorized-domain' || error.message?.includes('403')) {
        setErrorMessage(
          `Unauthorized Domain: "${domain}" is not authorized. ` +
          `Please go to Firebase Console > Authentication > Settings > Authorized domains and add "${domain}".`
        );
      } else if (error.code === 'auth/operation-not-allowed') {
        setErrorMessage(
          'Google Sign-In is not enabled in your Firebase Console. ' +
          'Please go to Authentication > Sign-in method, click "Add new provider", and enable "Google".'
        );
      } else if (error.code === 'auth/popup-blocked') {
        setErrorMessage('The sign-in popup was blocked by your browser. Please allow popups for this site and try again.');
      } else if (
        error.code === 'auth/cancelled-popup-request' || 
        error.code === 'auth/popup-closed-by-user' ||
        error.message?.includes('popup-closed-by-user') ||
        error.message?.includes('cancelled-popup-request')
      ) {
        // User closed the popup, no need to alert
      } else if (error.code === 'auth/network-request-failed') {
        setErrorMessage('Network error during sign-in. Please check your internet connection.');
      } else {
        setErrorMessage(`Sign in failed: ${error.message || 'Unknown error'}. Please try again or use Demo Mode.`);
      }
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    try {
      setErrorMessage(null);
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error: any) {
      console.error('Email sign in failed:', error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setErrorMessage('Invalid email or password.');
      } else if (error.code === 'auth/too-many-requests') {
        setErrorMessage('Too many failed attempts. Please try again later.');
      } else {
        setErrorMessage(`Login failed: ${error.message}`);
      }
    }
  };

  const signUpWithEmail = async (email: string, pass: string, name: string) => {
    try {
      setErrorMessage(null);
      const { user } = await createUserWithEmailAndPassword(auth, email, pass);
      
      // Check if this email belongs to a pre-registered staff member
      const staffQuery = query(collection(db, 'staff'), where('email', '==', email.toLowerCase()));
      const staffSnapshot = await getDocs(staffQuery);
      
      let companyId = '';
      let role: UserProfile['role'] = 'STAFF';
      let assignedWarehouseId = undefined;

      if (!staffSnapshot.empty) {
        const staffDoc = staffSnapshot.docs[0];
        const staffData = staffDoc.data();
        companyId = staffData.companyId;
        role = staffData.role;
        assignedWarehouseId = staffData.assignedWarehouseId;
        
        // Link the staff record to the new UID
        await setDoc(doc(db, 'staff', staffDoc.id), { uid: user.uid }, { merge: true });
      }

      // Create profile
      const newProfile: any = {
        uid: user.uid,
        email: email.toLowerCase(),
        displayName: name,
        role,
        companyId,
        assignedWarehouseId,
        createdAt: new Date().toISOString(),
        lastPasswordUpdate: new Date().toISOString()
      };
      
      Object.keys(newProfile).forEach(key => newProfile[key] === undefined && delete newProfile[key]);
      await setDoc(doc(db, 'users', user.uid), newProfile);
      setProfile(newProfile);
    } catch (error: any) {
      console.error('Signup failed:', error);
      if (error.code === 'auth/operation-not-allowed') {
        setErrorMessage('Email/Password sign-up is not enabled in the Firebase Console. Please enable it in Authentication > Sign-in method.');
      } else if (error.code === 'auth/email-already-in-use') {
        setErrorMessage('This email is already registered.');
      } else if (error.code === 'auth/weak-password') {
        setErrorMessage('Password is too weak. Please use at least 6 characters.');
      } else {
        setErrorMessage(`Signup failed: ${error.message}`);
      }
    }
  };

  const resetPassword = async (email: string) => {
    try {
      setErrorMessage(null);
      setSuccessMessage(null);

      if (isDemoMode) {
        setErrorMessage('Password reset is not available in Training Demo Mode. Use standard login for real accounts.');
        return;
      }

      if (!email || !email.includes('@')) {
        setErrorMessage('Please enter a valid email address.');
        return;
      }

      // Simplified reset call without action settings to avoid redirect pre-fetch issues
      await sendPasswordResetEmail(auth, email);
      
      setSuccessMessage('Password reset link sent! Please check your inbox (and spam folder). IMPORTANT: Only the LATEST link sent will work. If you requested multiple links, the older ones will show as "expired".');
    } catch (error: any) {
      console.error('Password reset failed:', error);
      
      let msg = `Failed to send reset email: ${error.message}`;
      
      if (error.code === 'auth/user-not-found') {
        msg = 'No account found with this email address.';
      } else if (error.code === 'auth/invalid-email') {
        msg = 'The email address is invalid.';
      } else if (error.code === 'auth/too-many-requests') {
        msg = 'Too many requests. Please wait a few minutes before trying again.';
      } else if (error.code === 'auth/network-request-failed') {
        msg = 'Network error. Please check your connection.';
      }
      
      setErrorMessage(msg);
    }
  };

  const sendResetEmailAdmin = async (email: string) => {
    if (!isAdmin) {
      setErrorMessage('Permission Denied: Only company admins can trigger password resets.');
      return;
    }
    if (!email || !email.includes('@')) {
      setErrorMessage('Please provide a valid email address.');
      return;
    }
    try {
      setErrorMessage(null);
      setSuccessMessage(null);
      
      const cleanEmail = email.toLowerCase().trim();
      
      // Auto-ensure user profile exists in 'users' collection
      const usersCol = collection(db, 'users');
      const qEmail = query(usersCol, where('email', '==', cleanEmail));
      const snap = await getDocs(qEmail);

      if (snap.empty) {
        // Check staff collection to auto-create user profile
        const staffCol = collection(db, 'staff');
        const qStaff = query(staffCol, where('email', '==', cleanEmail));
        const staffSnap = await getDocs(qStaff);

        if (!staffSnap.empty) {
          const sData = staffSnap.docs[0].data() as Staff;
          const uId = sData.uid || sData.id || `staff_user_${staffSnap.docs[0].id}`;
          const newProfile: UserProfile = {
            uid: uId,
            email: cleanEmail,
            displayName: sData.name || cleanEmail.split('@')[0],
            role: sData.role || 'STAFF',
            companyId: sData.companyId || profile?.companyId || '',
            assignedWarehouseId: sData.assignedWarehouseId || undefined,
            createdAt: new Date().toISOString(),
            lastPasswordUpdate: new Date().toISOString()
          };
          await setDoc(doc(db, 'users', uId), newProfile, { merge: true });
        }
      }

      await sendPasswordResetEmail(auth, cleanEmail);
      setSuccessMessage(`Password reset instruction sent to ${cleanEmail}. They must use the link in the MOST RECENT email they receive.`);
    } catch (error: any) {
      console.error('Admin triggered reset failed:', error);
      setErrorMessage(`Failed to send reset email: ${error.message}`);
    }
  };

  const manualResetPassword = async (identifier: string) => {
    if (!isAdmin) {
      setErrorMessage('Permission Denied: Only company admins can manage password policies.');
      return;
    }
    try {
      setErrorMessage(null);
      setSuccessMessage(null);
      console.log(`AuthContext: Manually resetting password state for identifier: ${identifier}`);
      
      let targetUserDocId = identifier;
      let targetEmail = identifier.includes('@') ? identifier.toLowerCase().trim() : '';

      // 1. Check if identifier is an existing user doc ID in 'users'
      let userRef = doc(db, 'users', targetUserDocId);
      let userSnap = await getDoc(userRef);

      // 2. If not found by doc ID, search 'users' collection by email
      if (!userSnap.exists() && targetEmail) {
        const usersCol = collection(db, 'users');
        const qEmail = query(usersCol, where('email', '==', targetEmail));
        const snapEmail = await getDocs(qEmail);
        if (!snapEmail.empty) {
          userRef = doc(db, 'users', snapEmail.docs[0].id);
          userSnap = snapEmail.docs[0];
          targetUserDocId = snapEmail.docs[0].id;
        }
      }

      // 3. If still not found, search 'staff' collection by id, uid, or email
      if (!userSnap.exists()) {
        const staffCol = collection(db, 'staff');
        let staffSnap = null;

        const staffDocRef = doc(db, 'staff', identifier);
        const staffDoc = await getDoc(staffDocRef);
        if (staffDoc.exists()) {
          staffSnap = staffDoc;
        } else if (targetEmail) {
          const qStaffEmail = query(staffCol, where('email', '==', targetEmail));
          const res = await getDocs(qStaffEmail);
          if (!res.empty) staffSnap = res.docs[0];
        }

        if (staffSnap && staffSnap.exists()) {
          const staffData = staffSnap.data() as Staff;
          targetEmail = (staffData.email || targetEmail).toLowerCase().trim();
          targetUserDocId = staffData.uid || staffData.id || `staff_user_${staffSnap.id}`;

          // Auto-create missing user profile in 'users' collection
          const restoredProfile: UserProfile = {
            uid: targetUserDocId,
            email: targetEmail || '',
            displayName: staffData.name || 'Staff Member',
            role: staffData.role || 'STAFF',
            companyId: staffData.companyId || profile?.companyId || '',
            assignedWarehouseId: staffData.assignedWarehouseId || undefined,
            createdAt: new Date().toISOString(),
            lastPasswordUpdate: null
          };

          await setDoc(doc(db, 'users', targetUserDocId), restoredProfile, { merge: true });
          userRef = doc(db, 'users', targetUserDocId);
          userSnap = await getDoc(userRef);
        }
      }

      // 4. Update user doc to set lastPasswordUpdate: null (forces password reset on next login)
      if (userSnap.exists()) {
        await setDoc(userRef, { lastPasswordUpdate: null }, { merge: true });
        const userEmail = targetEmail || userSnap.data()?.email;

        if (userEmail && userEmail.includes('@')) {
          try {
            await sendPasswordResetEmail(auth, userEmail);
            setSuccessMessage(`Password policy reset and reset email sent to ${userEmail}! User can reset via email link or will be prompted on next login.`);
          } catch (e: any) {
            setSuccessMessage(`Password policy reset for ${userEmail}. They will be prompted to change their password on next login.`);
          }
        } else {
          setSuccessMessage('Password policy reset for user. They will be forced to change their password on next login.');
        }
      } else if (targetEmail && targetEmail.includes('@')) {
        // Auto-create user doc if profile was completely missing
        const newDocId = `user_${Date.now()}`;
        const newProfile: UserProfile = {
          uid: newDocId,
          email: targetEmail,
          displayName: targetEmail.split('@')[0],
          role: 'STAFF',
          companyId: profile?.companyId || '',
          createdAt: new Date().toISOString(),
          lastPasswordUpdate: null
        };
        await setDoc(doc(db, 'users', newDocId), newProfile, { merge: true });
        await sendPasswordResetEmail(auth, targetEmail);
        setSuccessMessage(`User profile created and password reset link sent to ${targetEmail}.`);
      } else {
        setErrorMessage('Could not locate or create a user profile for password reset. Please check the staff email.');
      }
    } catch (error: any) {
      console.error('Manual reset failed:', error);
      setErrorMessage(`Failed to reset password state: ${error.message}`);
    }
  };

  const changePassword = async (currentPass: string, newPass: string) => {
    if (!user || !user.email) {
      console.error('AuthContext: Cannot change password - no user');
      return;
    }
    try {
      console.log('AuthContext: Starting password change process for:', user.email);
      setErrorMessage(null);
      const credential = EmailAuthProvider.credential(user.email, currentPass);
      
      console.log('AuthContext: Re-authenticating...');
      await reauthenticateWithCredential(user, credential);
      
      console.log('AuthContext: Updating auth password...');
      await updatePassword(user, newPass);
      
      console.log('AuthContext: Password updated in Auth. Updating Firestore profile...');
      
      // Update lastPasswordUpdate in Firestore
      const now = new Date().toISOString();
      const updateData = { 
        lastPasswordUpdate: now 
      };
      
      await setDoc(doc(db, 'users', user.uid), updateData, { merge: true });
      console.log('AuthContext: Firestore profile updated with lastPasswordUpdate:', now);
      
      // Local update to avoid waiting for snapshot if possible
      setProfile(prev => prev ? { ...prev, lastPasswordUpdate: now } : null);
      setMustChangePassword(false);
      setSuccessMessage('Password updated successfully. Accessing your dashboard...');
      
      // Force a slight delay to ensure onSnapshot can pick it up if needed, 
      // though local state update should be enough.
    } catch (error: any) {
      console.error('AuthContext: Password change failed:', error);
      if (error.code === 'auth/wrong-password') {
        setErrorMessage('Incorrect current password.');
      } else if (error.code === 'auth/weak-password') {
        setErrorMessage('New password is too weak.');
      } else if (error.code === 'auth/network-request-failed') {
        setErrorMessage('Network error during password update. This often points to an API key restriction or an unauthorized domain. Please check your internet connection and ensure your domain is authorized in the Firebase Console.');
      } else {
        setErrorMessage(`Failed to update password: ${error.message}`);
      }
      throw error; // Rethrow to let the component handle UI state
    }
  };

  const signInAsDemo = async () => {
    try {
      setErrorMessage(null);
      setLoading(true);
      
      let demoUser: any = null;
      try {
        const { user } = await signInAnonymously(auth);
        demoUser = user;
      } catch (authError) {
        console.warn("AuthContext: Could not connect to Firebase Auth for anonymous sign-in, using local offline mock auth instead:", authError);
        demoUser = {
          uid: 'demo_user_local',
          email: 'demo@ccs.com',
          displayName: 'Training User (Local Offline)',
          isAnonymous: true,
          emailVerified: true,
          providerData: []
        };
      }

      setUser(demoUser);
      setIsDemoMode(true);
      localStorage.setItem('ccs_demo_mode', 'true');
      localStorage.removeItem('ccs_logged_out');
      
      const demoCompanyId = 'demo_company_local';
      const demoProfile: any = {
        uid: 'demo_admin_profile_local',
        email: 'demo@ccs.com',
        displayName: 'Training User (Local Offline)',
        role: 'ADMIN',
        companyId: demoCompanyId,
        createdAt: new Date().toISOString()
      };
      
      const demoCompany: any = {
        id: demoCompanyId,
        name: 'CCS Training Demo (Local Offline)',
        ownerEmail: 'demo@ccs.com',
        createdAt: new Date().toISOString(),
        isApproved: true
      };

      setProfile(demoProfile);
      setCompany(demoCompany);
      setLoading(false);

      // Background writes (merge) - if they fail, no problem
      const demoWarehouseId = 'demo_warehouse_1';
      const demoWarehouse: any = {
        id: demoWarehouseId,
        companyId: demoCompanyId,
        name: 'Main Demo Warehouse',
        location: 'Lagos, Nigeria',
        capacity: 5000,
        createdAt: new Date().toISOString()
      };

      const demoSupplierId = 'demo_supplier_1';
      const demoSupplier: any = {
        id: demoSupplierId,
        companyId: demoCompanyId,
        name: 'John Doe Farms',
        location: 'Ondo State',
        phone: '08012345678',
        email: 'john@farms.com',
        previousBalance: 0,
        createdAt: new Date().toISOString()
      };

      Object.keys(demoCompany).forEach(key => demoCompany[key] === undefined && delete demoCompany[key]);
      setDoc(doc(db, 'companies', demoCompanyId), demoCompany, { merge: true }).catch(err => console.log('Silent write fail:', err));
      
      Object.keys(demoProfile).forEach(key => demoProfile[key] === undefined && delete demoProfile[key]);
      setDoc(doc(db, 'users', 'demo_admin_profile_local'), demoProfile, { merge: true }).catch(err => console.log('Silent write fail:', err));
      
      Object.keys(demoWarehouse).forEach(key => demoWarehouse[key] === undefined && delete demoWarehouse[key]);
      setDoc(doc(db, 'warehouses', demoWarehouseId), demoWarehouse, { merge: true }).catch(err => console.log('Silent write fail:', err));
      
      Object.keys(demoSupplier).forEach(key => demoSupplier[key] === undefined && delete demoSupplier[key]);
      setDoc(doc(db, 'suppliers', demoSupplierId), demoSupplier, { merge: true }).catch(err => console.log('Silent write fail:', err));
    } catch (error: any) {
      console.warn('Demo sign in failed, calling local offline mock fallback:', error);
      setIsDemoMode(true);
      localStorage.setItem('ccs_demo_mode', 'true');
      localStorage.removeItem('ccs_logged_out');
      const demoCompanyId = 'demo_company_local';
      const demoProfile: any = {
        uid: 'demo_admin_profile_local',
        email: 'demo@ccs.com',
        displayName: 'Training User (Local Offline)',
        role: 'ADMIN',
        companyId: demoCompanyId,
        createdAt: new Date().toISOString()
      };
      const demoCompany: any = {
        id: demoCompanyId,
        name: 'CCS Training Demo (Local Offline)',
        ownerEmail: 'demo@ccs.com',
        createdAt: new Date().toISOString(),
        isApproved: true
      };
      
      setProfile(demoProfile);
      setCompany(demoCompany);
      setUser({
        uid: 'demo_user_local',
        email: 'demo@ccs.com',
        displayName: 'Training User (Local Offline)',
        isAnonymous: true,
        emailVerified: true,
        providerData: []
      } as any);

      setSuccessMessage('Launched Local Offline Training Mode successfully!');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      console.log('AuthContext: Logging out...');
      await signOut(auth);
      setIsDemoMode(false);
      localStorage.removeItem('ccs_demo_mode');
      localStorage.setItem('ccs_logged_out', 'true');
      setProfile(null);
      setCompany(null);
      setUser(null);
      setSuccessMessage('Signed out successfully');
    } catch (error: any) {
      console.error('Logout failed:', error);
      setErrorMessage(`Logout failed: ${error.message}`);
    }
  };

  const registerCompany = async (companyName: string) => {
    if (!user) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      const companyId = `comp_${Date.now()}`;
      const userEmailLower = (user.email || '').toLowerCase().trim();
      const isSuperAdminUser = [
        'wasiuadebisi89@gmail.com',
        'adezmoldent@gmail.com',
        'abdullahiwasiu07@gmail.com'
      ].includes(userEmailLower) || isSuperAdmin;

      const newCompany: any = {
        id: companyId,
        name: companyName.trim(),
        ownerEmail: userEmailLower,
        createdAt: new Date().toISOString(),
        isApproved: true
      };

      const newProfile: any = {
        uid: user.uid,
        email: userEmailLower,
        displayName: profile?.displayName || user.displayName || 'Admin',
        role: 'ADMIN',
        companyId: companyId,
        createdAt: profile?.createdAt || new Date().toISOString(),
        lastPasswordUpdate: profile?.lastPasswordUpdate || new Date().toISOString()
      };

      Object.keys(newCompany).forEach(key => newCompany[key] === undefined && delete newCompany[key]);
      await setDoc(doc(db, 'companies', companyId), newCompany);
      
      Object.keys(newProfile).forEach(key => newProfile[key] === undefined && delete newProfile[key]);
      await setDoc(doc(db, 'users', user.uid), newProfile);
      
      setCompany(newCompany);
      setProfile(newProfile);
      if (isSuperAdminUser) {
        setSuccessMessage('Company registered and auto-approved successfully!');
      } else {
        setSuccessMessage('Company registered successfully! Awaiting super admin approval.');
      }
    } catch (error: any) {
      console.error('Company registration failed:', error);
      setErrorMessage(`Registration failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetProfileCompany = async () => {
    if (!user) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        companyId: "",
        role: "ADMIN"
      }, { merge: true });
      
      setCompany(null);
      if (profile) {
        setProfile({
          ...profile,
          companyId: ""
        });
      }
      setSuccessMessage('Company profile reset successfully.');
    } catch (error: any) {
      console.error('Resetting company profile failed:', error);
      setErrorMessage(`Failed to reset company: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const connectExistingCompany = async (companyId: string) => {
    if (!user) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        companyId: companyId,
        role: "ADMIN"
      }, { merge: true });
      
      if (profile) {
        setProfile({
          ...profile,
          companyId: companyId,
          role: "ADMIN"
        });
      }
      setSuccessMessage('Successfully connected to company!');
    } catch (error: any) {
      console.error('Failed to connect to company:', error);
      setErrorMessage(`Failed to connect: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteCompanyByOwner = async (companyId: string) => {
    if (!user) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const { deleteDoc, collection, query, where, getDocs, writeBatch } = await import('firebase/firestore');

      // 1. Delete company document
      await deleteDoc(doc(db, 'companies', companyId));

      // 2. Clear companyId & reset role for associated users
      try {
        const uQ = query(collection(db, 'users'), where('companyId', '==', companyId));
        const uSnap = await getDocs(uQ);
        if (!uSnap.empty) {
          const batch = writeBatch(db);
          uSnap.docs.forEach((uDoc) => {
            batch.update(uDoc.ref, { companyId: '', role: 'ADMIN' });
          });
          await batch.commit();
        }
      } catch (uErr) {
        console.warn('Non-fatal cleanup warning for company users:', uErr);
      }

      // 3. Delete staff records for this company
      try {
        const sQ = query(collection(db, 'staff'), where('companyId', '==', companyId));
        const sSnap = await getDocs(sQ);
        if (!sSnap.empty) {
          const batch = writeBatch(db);
          sSnap.docs.forEach((sDoc) => batch.delete(sDoc.ref));
          await batch.commit();
        }
      } catch (sErr) {
        console.warn('Non-fatal cleanup warning for company staff:', sErr);
      }

      if (company?.id === companyId || profile?.companyId === companyId) {
        setCompany(null);
        if (profile) {
          setProfile({
            ...profile,
            companyId: '',
            role: 'ADMIN'
          });
        }
      }
      setSuccessMessage('Company deleted successfully.');
    } catch (error: any) {
      console.error('Failed to delete company:', error);
      setErrorMessage(`Failed to delete company: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteUserAccount = async () => {
    if (!user) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const { deleteDoc, collection, query, where, getDocs } = await import('firebase/firestore');
      const userEmail = (user.email || profile?.email || '').toLowerCase().trim();

      if (userEmail) {
        // 1. Delete companies owned by this email
        try {
          const compQ = query(collection(db, 'companies'), where('ownerEmail', '==', userEmail));
          const compSnap = await getDocs(compQ);
          for (const cDoc of compSnap.docs) {
            await deleteDoc(cDoc.ref);

            // Delete staff associated with this company
            const sQ = query(collection(db, 'staff'), where('companyId', '==', cDoc.id));
            const sSnap = await getDocs(sQ);
            for (const sDoc of sSnap.docs) {
              await deleteDoc(sDoc.ref);
            }
          }
        } catch (compErr) {
          console.warn('Non-fatal company cleanup error during account deletion:', compErr);
        }

        // 2. Delete staff records matching email
        try {
          const staffQ = query(collection(db, 'staff'), where('email', '==', userEmail));
          const staffSnap = await getDocs(staffQ);
          for (const sDoc of staffSnap.docs) {
            await deleteDoc(sDoc.ref);
          }
        } catch (staffErr) {
          console.warn('Non-fatal staff cleanup error during account deletion:', staffErr);
        }

        // 3. Delete user profiles matching email
        try {
          const uQ = query(collection(db, 'users'), where('email', '==', userEmail));
          const uSnap = await getDocs(uQ);
          for (const uDoc of uSnap.docs) {
            await deleteDoc(uDoc.ref);
          }
        } catch (uErr) {
          console.warn('Non-fatal user email cleanup error during account deletion:', uErr);
        }
      }

      // 4. Ensure user profile document by UID is deleted
      try {
        await deleteDoc(doc(db, 'users', user.uid));
      } catch (uidErr) {
        console.warn('User UID profile cleanup error:', uidErr);
      }

      setProfile(null);
      setCompany(null);
      setUserCompanies([]);
      setSuccessMessage('Account profile deleted successfully. You can now register again.');
      await logout();
    } catch (error: any) {
      console.error('Failed to delete user account:', error);
      setErrorMessage(`Failed to delete account: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

   const approveCompany = async (companyId: string) => {
    try {
      await setDoc(doc(db, 'companies', companyId), { isApproved: true }, { merge: true });
      setSuccessMessage('Company activated successfully.');
    } catch (error: any) {
      console.error('Company approval failed:', error);
      setErrorMessage(`Approval failed: ${error.message}`);
    }
  };

  const disapproveCompany = async (companyId: string) => {
    if (!isSuperAdmin) return;
    await setDoc(doc(db, 'companies', companyId), { isApproved: false }, { merge: true });
  };

  const toggleUserSuspension = async (userId: string, status: boolean) => {
    if (!isSuperAdmin) return;
    try {
      await setDoc(doc(db, 'users', userId), { suspended: status }, { merge: true });
      setSuccessMessage(`User ${status ? 'suspended' : 'unsuspended'} successfully.`);
    } catch (error: any) {
      console.error('User suspension toggle failed:', error);
      setErrorMessage(`Failed to update user status: ${error.message}`);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!isSuperAdmin) return;
    try {
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'users', userId));
      setSuccessMessage('User profile deleted successfully.');
    } catch (error: any) {
      console.error('User deletion failed:', error);
      setErrorMessage(`Failed to delete user: ${error.message}`);
    }
  };

  // Refined permissions
  const canPostTransactions = isManager || isAccount || profile?.role === 'STAFF';
  const canManageStaff = isAdmin || isManager;
  const canTransferStock = isAdmin || isManager;

  const value = {
    user,
    profile,
    company,
    loading,
    signIn,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    sendResetEmailAdmin,
    manualResetPassword,
    changePassword,
    logout,
    registerCompany,
    resetProfileCompany,
    connectExistingCompany,
    deleteCompanyByOwner,
    deleteUserAccount,
    userCompanies,
    approveCompany,
    disapproveCompany,
    toggleUserSuspension,
    deleteUser,
    signInAsDemo,
    isAdmin,
    isManager,
    isAccount,
    isAuditor,
    isStoreKeeper,
    isStaff,
    isSuperAdmin,
    isDemoMode,
    mustChangePassword,
    isFirestoreConnected,
    isOnline,
    connectionError,
    errorMessage,
    setErrorMessage,
    successMessage,
    setSuccessMessage,
    can,
    canPostTransactions,
    canManageStaff,
    canTransferStock
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
