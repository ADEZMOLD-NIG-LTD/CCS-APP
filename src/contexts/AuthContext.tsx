/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
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
import { auth, db, firebaseConfig } from '../firebase';
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
  changePassword: (currentPass: string, newPass: string) => Promise<void>;
  logout: () => Promise<void>;
  registerCompany: (companyName: string) => Promise<void>;
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
  | 'manage_store_records';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [isFirestoreConnected, setIsFirestoreConnected] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Permission Engine Logic
  const can = (action: PermissionAction): boolean => {
    if (user?.email?.toLowerCase() === 'wasiuadebisi89@gmail.com') return true; // Super Admin bypass
    if (isDemoMode) return true; // Demo mode has all permissions
    if (!profile) return false;

    const role = profile.role;

    switch (action) {
      case 'manage_users':
        return role === 'ADMIN';
      case 'manage_companies':
        return false; // Only super admin via direct DB or special UI
      case 'manage_suppliers':
      case 'manage_buyers':
      case 'manage_inventory':
        return ['ADMIN', 'MANAGER', 'STAFF'].includes(role);
      case 'manage_staff':
        return ['ADMIN', 'MANAGER'].includes(role);
      case 'manage_payroll':
      case 'manage_journal':
        return ['ADMIN', 'ACCOUNT'].includes(role);
      case 'view_reports':
      case 'view_analytics':
        return ['ADMIN', 'MANAGER', 'ACCOUNT', 'AUDITOR'].includes(role);
      case 'manage_warehouses':
        return ['ADMIN', 'MANAGER'].includes(role);
      case 'manage_store_records':
        return ['ADMIN', 'MANAGER', 'STORE_KEEPER'].includes(role);
      default:
        return false;
    }
  };

  console.log('AuthProvider: State', { loading, user: user?.uid, isDemoMode, isFirestoreConnected });

  useEffect(() => {
    async function testConnection() {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection test timeout')), 20000)
      );
      
      try {
        console.log("Testing Firestore connection...");
        await Promise.race([
          getDocFromServer(doc(db, 'test', 'connection')),
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

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;
    let unsubscribeCompany: (() => void) | null = null;

    // Safety timeout to ensure the app doesn't get stuck on the loading screen
    const loadingTimeout = setTimeout(() => {
      if (loading) {
        console.warn('AuthContext: Loading state timed out after 10s. Forcing initialization.');
        setLoading(false);
      }
    }, 10000);

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      clearTimeout(loadingTimeout);
      console.log('AuthContext: onAuthStateChanged', user?.uid || 'no user');
      setUser(user);
      
      if (user) {
        if (user.isAnonymous) {
          setIsDemoMode(true);
        }

        if (unsubscribeProfile) {
          console.log('Unsubscribing from profile...');
          unsubscribeProfile();
        }
        if (unsubscribeCompany) {
          console.log('Unsubscribing from company...');
          unsubscribeCompany();
        }

        console.log('Setting up profile listener for user:', user.uid);
        const profileId = user.isAnonymous ? 'demo_admin_profile' : user.uid;
        const userRef = doc(db, 'users', profileId);
        
        unsubscribeProfile = onSnapshot(userRef, async (userDoc) => {
          console.log('Profile snapshot received:', userDoc.exists() ? 'exists' : 'does not exist');
          if (userDoc.exists()) {
            const data = userDoc.data() as UserProfile;
            
            // Check for suspension
            if (data.suspended && !isSuperAdmin) {
              console.warn('User is suspended. Signing out.');
              setErrorMessage('Your account has been suspended. Please contact the Super Admin.');
              signOut(auth);
              return;
            }

            setProfile(data);

            // Check for password expiration (90 days)
            const isEmailUser = user.providerData.some(p => p.providerId === 'password');
            if (isEmailUser && data.lastPasswordUpdate) {
              const lastUpdate = new Date(data.lastPasswordUpdate).getTime();
              const now = new Date().getTime();
              const diffDays = (now - lastUpdate) / (1000 * 60 * 60 * 24);
              if (diffDays >= 90) {
                setMustChangePassword(true);
              } else {
                setMustChangePassword(false);
              }
            } else if (isEmailUser && !data.lastPasswordUpdate) {
              // If no update date, force change (initial login)
              setMustChangePassword(true);
            } else {
              setMustChangePassword(false);
            }
            
            if (data.companyId) {
              console.log('Setting up company listener for:', data.companyId);
              const companyRef = doc(db, 'companies', data.companyId);
              if (unsubscribeCompany) unsubscribeCompany();
              
              unsubscribeCompany = onSnapshot(companyRef, (companyDoc) => {
                console.log('Company snapshot received:', companyDoc.exists() ? 'exists' : 'does not exist');
                if (companyDoc.exists()) {
                  setCompany(companyDoc.data() as Company);
                }
              }, (error) => {
                setErrorMessage(reportFirestoreError(error, OperationType.GET, `companies/${data.companyId}`));
              });
            }

            // Ensure the designated super admin always has the ADMIN role
            if (user.email?.toLowerCase() === 'wasiuadebisi89@gmail.com' && data.role !== 'ADMIN') {
              try {
                const updateData = { ...data, role: 'ADMIN' };
                Object.keys(updateData).forEach(key => (updateData as any)[key] === undefined && delete (updateData as any)[key]);
                await setDoc(userRef, updateData, { merge: true });
              } catch (error) {
                setErrorMessage(reportFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`));
              }
            }
          } else {
            // Check if this user is a pre-registered staff member
            if (user.email) {
              try {
                const staffQuery = query(
                  collection(db, 'staff'),
                  where('email', '==', user.email.toLowerCase())
                );
                const staffDocs = await getDocs(staffQuery);
                
                if (!staffDocs.empty) {
                  const staffData = staffDocs.docs[0].data() as Staff;
                  const newProfile: any = {
                    uid: user.uid,
                    email: user.email.toLowerCase(),
                    displayName: user.displayName || staffData.name,
                    role: staffData.role,
                    companyId: staffData.companyId,
                    assignedWarehouseId: staffData.assignedWarehouseId,
                    createdAt: new Date().toISOString()
                  };
                  
                  Object.keys(newProfile).forEach(key => newProfile[key] === undefined && delete newProfile[key]);
                  await setDoc(userRef, newProfile);
                  // Profile will be set by the onSnapshot listener
                  
                  // Update staff record with UID to mark as joined
                  const staffUpdate = { uid: user.uid };
                  await setDoc(doc(db, 'staff', staffDocs.docs[0].id), staffUpdate, { merge: true });
                } else {
                  setProfile(null);
                  setCompany(null);
                }
              } catch (error) {
                setErrorMessage(reportFirestoreError(error, OperationType.GET, 'staff'));
                setProfile(null);
                setCompany(null);
              }
            } else {
              setProfile(null);
              setCompany(null);
            }
          }
        }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.GET, `users/${user.uid}`)));
      } else {
        setIsDemoMode(false);
        setProfile(null);
        setCompany(null);
        if (unsubscribeProfile) unsubscribeProfile();
        if (unsubscribeCompany) unsubscribeCompany();
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeCompany) unsubscribeCompany();
    };
  }, [isDemoMode]);

  const signIn = async () => {
    try {
      setErrorMessage(null);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      
      // Detect mobile devices and iframe environment
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const isIframe = window.self !== window.top;
      
      // In an iframe (like AI Studio), signInWithRedirect almost always fails with a 403 or redirect loop
      // We should prefer Popup in iframes if possible, or show a clear warning
      if (isMobile && !isIframe) {
        console.log('Mobile (non-iframe) detected, using signInWithRedirect');
        await signInWithRedirect(auth, provider);
      } else {
        console.log(isIframe ? 'Iframe detected, using signInWithPopup' : 'Desktop detected, using signInWithPopup');
        await signInWithPopup(auth, provider);
      }
    } catch (error: any) {
      console.error('Sign in failed:', error);
      if (error.code === 'auth/unauthorized-domain' || error.message?.includes('403')) {
        const domain = window.location.hostname;
        setErrorMessage(
          `Unauthorized Domain: The domain "${domain}" is not authorized for Google Sign-In in your Firebase Console. ` +
          `Please go to Authentication > Settings > Authorized domains and add "${domain}".`
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
      await sendPasswordResetEmail(auth, email);
      setSuccessMessage('Password reset link sent to your email. It will expire in 1 hour.');
    } catch (error: any) {
      console.error('Password reset failed:', error);
      setErrorMessage(`Failed to send reset email: ${error.message}`);
    }
  };

  const changePassword = async (currentPass: string, newPass: string) => {
    if (!user || !user.email) return;
    try {
      setErrorMessage(null);
      const credential = EmailAuthProvider.credential(user.email, currentPass);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPass);
      
      // Update lastPasswordUpdate in Firestore
      if (profile) {
        const updateData = { 
          lastPasswordUpdate: new Date().toISOString() 
        };
        await setDoc(doc(db, 'users', user.uid), updateData, { merge: true });
      }
      
      setMustChangePassword(false);
      setSuccessMessage('Password updated successfully.');
    } catch (error: any) {
      console.error('Password change failed:', error);
      if (error.code === 'auth/wrong-password') {
        setErrorMessage('Incorrect current password.');
      } else if (error.code === 'auth/weak-password') {
        setErrorMessage('New password is too weak.');
      } else {
        setErrorMessage(`Failed to update password: ${error.message}`);
      }
    }
  };

  const signInAsDemo = async () => {
    try {
      setErrorMessage(null);
      setLoading(true);
      const { user } = await signInAnonymously(auth);
      setIsDemoMode(true);
      
      const demoCompanyId = 'demo_company';
      const demoProfile: any = {
        uid: 'demo_admin_profile',
        email: 'demo@ccs.com',
        displayName: 'Training User',
        role: 'ADMIN',
        companyId: demoCompanyId,
        createdAt: new Date().toISOString()
      };
      
      const demoCompany: any = {
        id: demoCompanyId,
        name: 'CCS Training Demo',
        ownerEmail: 'demo@ccs.com',
        createdAt: new Date().toISOString(),
        isApproved: true
      };

      // Create/Update demo data in Firestore
      Object.keys(demoCompany).forEach(key => demoCompany[key] === undefined && delete demoCompany[key]);
      await setDoc(doc(db, 'companies', demoCompanyId), demoCompany, { merge: true });
      
      Object.keys(demoProfile).forEach(key => demoProfile[key] === undefined && delete demoProfile[key]);
      await setDoc(doc(db, 'users', 'demo_admin_profile'), demoProfile, { merge: true });

      // Seed some demo data if it's a fresh demo session
      const demoWarehouseId = 'demo_warehouse_1';
      const demoWarehouse: any = {
        id: demoWarehouseId,
        companyId: demoCompanyId,
        name: 'Main Demo Warehouse',
        location: 'Lagos, Nigeria',
        capacity: 5000,
        createdAt: new Date().toISOString()
      };
      Object.keys(demoWarehouse).forEach(key => demoWarehouse[key] === undefined && delete demoWarehouse[key]);
      await setDoc(doc(db, 'warehouses', demoWarehouseId), demoWarehouse, { merge: true });

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
      Object.keys(demoSupplier).forEach(key => demoSupplier[key] === undefined && delete demoSupplier[key]);
      await setDoc(doc(db, 'suppliers', demoSupplierId), demoSupplier, { merge: true });
      
      setProfile(demoProfile);
      setCompany(demoCompany);
    } catch (error: any) {
      console.error('Demo sign in failed:', error);
      if (error.code === 'auth/admin-restricted-operation') {
        setErrorMessage('Training Demo Mode requires "Anonymous Authentication" to be enabled in the Firebase Console. Please contact the Super Admin.');
      } else {
        setErrorMessage('Failed to start demo mode. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      console.log('AuthContext: Logging out...');
      await signOut(auth);
      setIsDemoMode(false);
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
      const newCompany: any = {
        id: companyId,
        name: companyName,
        ownerEmail: user.email || '',
        createdAt: new Date().toISOString(),
        isApproved: false // Requires super admin approval
      };

      const newProfile: any = {
        uid: user.uid,
        email: user.email || '',
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
      setSuccessMessage('Company registered successfully! Awaiting admin approval.');
    } catch (error: any) {
      console.error('Company registration failed:', error);
      setErrorMessage(`Registration failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const approveCompany = async (companyId: string) => {
    if (user?.email?.toLowerCase() !== 'wasiuadebisi89@gmail.com') return;
    try {
      await setDoc(doc(db, 'companies', companyId), { isApproved: true }, { merge: true });
      setSuccessMessage('Company approved successfully.');
    } catch (error: any) {
      console.error('Company approval failed:', error);
      setErrorMessage(`Approval failed: ${error.message}`);
    }
  };

  const disapproveCompany = async (companyId: string) => {
    if (user?.email?.toLowerCase() !== 'wasiuadebisi89@gmail.com') return;
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

  const isSuperAdmin = user?.email?.toLowerCase() === 'wasiuadebisi89@gmail.com' || user?.email?.toLowerCase() === 'abdullahiwasiu07@gmail.com';
  const isAdmin = profile?.role === 'ADMIN' || isSuperAdmin;
  const isManager = profile?.role === 'MANAGER' || isAdmin;
  const isAccount = profile?.role === 'ACCOUNT' || isManager;
  const isAuditor = profile?.role === 'AUDITOR' || isManager;
  const isStoreKeeper = profile?.role === 'STORE_KEEPER' || isAdmin;
  const isStaff = profile?.role === 'STAFF' || isAccount || isAuditor || isStoreKeeper;

  // Refined permissions
  const canPostTransactions = isManager || isAccount;
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
    changePassword,
    logout,
    registerCompany,
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
