/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  signInAnonymously,
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
  getDocs
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserProfile, Company, Staff } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  company: Company | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
  registerCompany: (companyName: string) => Promise<void>;
  approveCompany: (companyId: string) => Promise<void>;
  signInAsDemo: () => void;
  isAdmin: boolean;
  isAccount: boolean;
  isAuditor: boolean;
  isStaff: boolean;
  isSuperAdmin: boolean;
  isDemoMode: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  console.log('AuthProvider: State', { loading, user: user?.uid, isDemoMode });

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;
    let unsubscribeCompany: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      console.log('AuthContext: onAuthStateChanged', user?.uid);
      setUser(user);
      
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeCompany) unsubscribeCompany();

      if (user) {
        const userRef = doc(db, 'users', user.uid);
        
        unsubscribeProfile = onSnapshot(userRef, async (userDoc) => {
          if (userDoc.exists()) {
            const data = userDoc.data() as UserProfile;
            setProfile(data);
            
            if (data.companyId) {
              const companyRef = doc(db, 'companies', data.companyId);
              if (unsubscribeCompany) unsubscribeCompany();
              
              unsubscribeCompany = onSnapshot(companyRef, (companyDoc) => {
                if (companyDoc.exists()) {
                  setCompany(companyDoc.data() as Company);
                }
              });
            }

            // Ensure the designated super admin always has the ADMIN role
            if (user.email?.toLowerCase() === 'wasiuadebisi89@gmail.com' && data.role !== 'ADMIN') {
              await setDoc(userRef, { ...data, role: 'ADMIN' }, { merge: true });
            }
          } else {
            // Check if this user is a pre-registered staff member
            if (user.email) {
              const staffQuery = query(
                collection(db, 'staff'),
                where('email', '==', user.email.toLowerCase())
              );
              const staffDocs = await getDocs(staffQuery);
              
              if (!staffDocs.empty) {
                const staffData = staffDocs.docs[0].data() as Staff;
                const newProfile: UserProfile = {
                  uid: user.uid,
                  email: user.email.toLowerCase(),
                  displayName: user.displayName || staffData.name,
                  role: staffData.role,
                  companyId: staffData.companyId,
                  assignedWarehouseId: staffData.assignedWarehouseId,
                  createdAt: new Date().toISOString()
                };
                
                await setDoc(userRef, newProfile);
                // Profile will be set by the onSnapshot listener
                
                // Update staff record with UID to mark as joined
                await setDoc(doc(db, 'staff', staffDocs.docs[0].id), { uid: user.uid }, { merge: true });
              } else {
                setProfile(null);
                setCompany(null);
              }
            } else {
              setProfile(null);
              setCompany(null);
            }
          }
        });
      } else if (!isDemoMode) {
        setProfile(null);
        setCompany(null);
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
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signInAsDemo = async () => {
    try {
      setLoading(true);
      const { user } = await signInAnonymously(auth);
      setIsDemoMode(true);
      
      const demoCompanyId = 'demo_company';
      const demoProfile: UserProfile = {
        uid: user.uid,
        email: 'demo@ccs.com',
        displayName: 'Training User',
        role: 'ADMIN',
        companyId: demoCompanyId,
        createdAt: new Date().toISOString()
      };
      
      const demoCompany: Company = {
        id: demoCompanyId,
        name: 'CCS Training Demo',
        ownerEmail: 'demo@ccs.com',
        createdAt: new Date().toISOString(),
        isApproved: true
      };

      // Create/Update demo data in Firestore
      await setDoc(doc(db, 'companies', demoCompanyId), demoCompany, { merge: true });
      await setDoc(doc(db, 'users', user.uid), demoProfile, { merge: true });

      // Seed some demo data if it's a fresh demo session
      const demoWarehouseId = 'demo_warehouse_1';
      await setDoc(doc(db, 'warehouses', demoWarehouseId), {
        id: demoWarehouseId,
        companyId: demoCompanyId,
        name: 'Main Demo Warehouse',
        location: 'Lagos, Nigeria',
        capacity: 5000,
        createdAt: new Date().toISOString()
      }, { merge: true });

      const demoSupplierId = 'demo_supplier_1';
      await setDoc(doc(db, 'suppliers', demoSupplierId), {
        id: demoSupplierId,
        companyId: demoCompanyId,
        name: 'John Doe Farms',
        location: 'Ondo State',
        phone: '08012345678',
        email: 'john@farms.com',
        previousBalance: 0,
        createdAt: new Date().toISOString()
      }, { merge: true });
      
      setProfile(demoProfile);
      setCompany(demoCompany);
    } catch (error: any) {
      console.error('Demo sign in failed:', error);
      if (error.code === 'auth/admin-restricted-operation') {
        alert('Training Demo Mode requires "Anonymous Authentication" to be enabled in the Firebase Console. Please contact the Super Admin.');
      } else {
        alert('Failed to start demo mode. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    if (isDemoMode) {
      setIsDemoMode(false);
      setProfile(null);
      setCompany(null);
      setUser(null);
    } else {
      await signOut(auth);
    }
  };

  const registerCompany = async (companyName: string) => {
    if (!user) return;

    const companyId = `comp_${Date.now()}`;
    const newCompany: Company = {
      id: companyId,
      name: companyName,
      ownerEmail: user.email || '',
      createdAt: new Date().toISOString(),
      isApproved: false // Requires super admin approval
    };

    const newProfile: UserProfile = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || 'Admin',
      role: 'ADMIN',
      companyId: companyId,
      createdAt: new Date().toISOString()
    };

    await setDoc(doc(db, 'companies', companyId), newCompany);
    await setDoc(doc(db, 'users', user.uid), newProfile);
    
    setCompany(newCompany);
    setProfile(newProfile);
  };

  const approveCompany = async (companyId: string) => {
    if (user?.email?.toLowerCase() !== 'wasiuadebisi89@gmail.com') return;
    await setDoc(doc(db, 'companies', companyId), { isApproved: true }, { merge: true });
  };

  const isSuperAdmin = user?.email?.toLowerCase() === 'wasiuadebisi89@gmail.com';
  const isAdmin = profile?.role === 'ADMIN' || isSuperAdmin;
  const isAccount = profile?.role === 'ACCOUNT' || isAdmin;
  const isAuditor = profile?.role === 'AUDITOR' || isAdmin;
  const isStaff = !!profile?.role || isAdmin;

  const value = {
    user,
    profile,
    company,
    loading,
    signIn,
    logout,
    registerCompany,
    approveCompany,
    signInAsDemo,
    isAdmin,
    isAccount,
    isAuditor,
    isStaff,
    isSuperAdmin,
    isDemoMode
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
