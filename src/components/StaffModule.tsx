/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { 
  Plus, 
  Users, 
  Calendar, 
  Phone, 
  Briefcase, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Trash2,
  UserPlus,
  UserMinus,
  UserCheck,
  UserX,
  History,
  DollarSign,
  Building2,
  FileText,
  Calculator,
  Download,
  CreditCard,
  Lock,
  Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Staff, Attendance, Warehouse, Roster, Payroll } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, query, orderBy, deleteDoc, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, reportFirestoreError, formatFirestoreError, OperationType } from '../lib/firestore';
import { cn } from '../lib/utils';
import Toast from './Toast';
import ConfirmModal from './ConfirmModal';

export default function StaffModule() {
  const { profile, company, isAdmin, isAccount, canManageStaff } = useAuth();
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [viewingPayroll, setViewingPayroll] = useState<Payroll | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(profile?.assignedWarehouseId || 'ALL');

  // Success message auto-hide
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const [activeTab, setActiveTab] = useState<'roster' | 'attendance' | 'payroll'>('roster');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  // Load Data from Firestore
  useEffect(() => {
    if (!profile?.companyId) return;

    const qStaff = query(
      collection(db, 'staff'), 
      where('companyId', '==', profile.companyId),
      orderBy('name', 'asc')
    );
    const unsubscribeStaff = onSnapshot(qStaff, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Staff));
      setStaffList(data);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'staff')));

    const qAttendance = query(
      collection(db, 'attendance'), 
      where('companyId', '==', profile.companyId),
      orderBy('date', 'desc')
    );
    const unsubscribeAttendance = onSnapshot(qAttendance, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Attendance));
      setAttendance(data);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'attendance')));

    const qWarehouses = query(
      collection(db, 'warehouses'),
      where('companyId', '==', profile.companyId)
    );
    const unsubscribeWarehouses = onSnapshot(qWarehouses, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Warehouse));
      setWarehouses(data);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'warehouses')));

    const qRosters = query(
      collection(db, 'rosters'),
      where('companyId', '==', profile.companyId)
    );
    const unsubscribeRosters = onSnapshot(qRosters, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Roster));
      setRosters(data);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'rosters')));

    const qPayrolls = query(
      collection(db, 'payrolls'),
      where('companyId', '==', profile.companyId),
      where('month', '==', selectedMonth)
    );
    const unsubscribePayrolls = onSnapshot(qPayrolls, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Payroll));
      setPayrolls(data);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'payrolls')));

    return () => {
      unsubscribeStaff();
      unsubscribeAttendance();
      unsubscribeWarehouses();
      unsubscribeRosters();
      unsubscribePayrolls();
    };
  }, [profile?.companyId, selectedMonth]);

  const filteredStaff = useMemo(() => {
    if (selectedWarehouseId === 'ALL') return staffList;
    return staffList.filter(s => s.assignedWarehouseId === selectedWarehouseId);
  }, [staffList, selectedWarehouseId]);

  const filteredPayrolls = useMemo(() => {
    if (selectedWarehouseId === 'ALL') return payrolls;
    return payrolls.filter(p => {
      const staff = staffList.find(s => s.id === p.staffId);
      return staff?.assignedWarehouseId === selectedWarehouseId;
    });
  }, [payrolls, staffList, selectedWarehouseId]);

  const calculatePAYE = (grossMonthly: number, pensionMonthly: number) => {
    const annualGross = grossMonthly * 12;
    const annualPension = pensionMonthly * 12;
    
    // CRA Calculation: Higher of N200,000 or 1% of Gross, plus 20% of Gross
    const craBase = Math.max(200000, 0.01 * annualGross);
    const annualCRA = craBase + (0.2 * annualGross);
    
    const annualTaxable = Math.max(0, annualGross - annualCRA - annualPension);
    
    let annualTax = 0;
    let remainingTaxable = annualTaxable;
    
    const rates = [
      { limit: 300000, rate: 0.07 },
      { limit: 300000, rate: 0.11 },
      { limit: 500000, rate: 0.15 },
      { limit: 500000, rate: 0.19 },
      { limit: 1600000, rate: 0.21 },
      { limit: Infinity, rate: 0.24 },
    ];
    
    for (const r of rates) {
      if (remainingTaxable <= 0) break;
      const taxableAtThisRate = Math.min(remainingTaxable, r.limit);
      annualTax += taxableAtThisRate * r.rate;
      remainingTaxable -= taxableAtThisRate;
    }
    
    const minimumTax = 0.01 * annualGross;
    const finalAnnualTax = Math.max(annualTax, minimumTax);
    
    return finalAnnualTax / 12;
  };

  const generatePayroll = async () => {
    if (!isAccount && !isAdmin) return;
    if (submitting || !profile?.companyId) return;

    setSubmitting(true);
    try {
      for (const staff of filteredStaff) {
        if (staff.status !== 'ACTIVE') continue;
        
        const basic = staff.salary || 0;
        const allowances = staff.allowances || 0;
        const gross = basic + allowances;
        const pension = (basic + allowances) * 0.08; // Simplified pension calculation
        const paye = calculatePAYE(gross, pension);
        const netPay = gross - pension - paye;

        const payrollId = `${selectedMonth}_${staff.id}`;
        const payrollRecord: Payroll = {
          id: payrollId,
          companyId: profile.companyId,
          staffId: staff.id,
          month: selectedMonth,
          basicSalary: basic,
          allowances: allowances,
          grossIncome: gross,
          cra: 0, // Calculated internally in PAYE logic
          taxableIncome: gross - pension, // Simplified for display
          paye: paye,
          pension: pension,
          netPay: netPay,
          status: 'PENDING',
          createdAt: new Date().toISOString()
        };

        await setDoc(doc(db, 'payrolls', payrollId), payrollRecord);
      }
      setSuccessMessage(`Payroll generated for ${selectedMonth}`);
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, OperationType.WRITE, 'payrolls'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddStaff = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canManageStaff || submitting || !profile?.companyId) return;

    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const id = crypto.randomUUID();
    const email = (formData.get('email') as string)?.toLowerCase();
    const role = formData.get('role') as Staff['role'];
    const warehouseId = formData.get('warehouseId') as string;
    const createAccount = formData.get('createAccount') === 'on';

    const newStaff: Staff = {
      id,
      companyId: profile.companyId,
      name: formData.get('name') as string,
      role,
      phone: formData.get('phone') as string,
      salary: Number(formData.get('salary')),
      allowances: Number(formData.get('allowances') || 0),
      joinedDate: new Date().toISOString(),
      status: 'ACTIVE',
      bankName: formData.get('bankName') as string,
      accountNumber: formData.get('accountNumber') as string,
      ...(email ? { email } : {}),
      ...(warehouseId ? { assignedWarehouseId: warehouseId } : {})
    };

    try {
      let authUid = undefined;
      // If requested, create a Firebase Auth account with a default password
      if (createAccount && email) {
        const secondaryApp = getApps().find(app => app.name === 'Secondary') || initializeApp(firebaseConfig, 'Secondary');
        const secondaryAuth = getAuth(secondaryApp);
        const defaultPassword = 'Welcome@CCS2025';
        
        try {
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, defaultPassword);
          authUid = userCredential.user.uid;
          await signOut(secondaryAuth);
        } catch (authError: any) {
          if (authError.code === 'auth/email-already-in-use') {
            // Account already exists, just link it
            console.log('Auth account already exists for this email.');
          } else {
            throw authError;
          }
        }
      }

      const finalStaff: Staff = {
        ...newStaff,
        ...(authUid ? { uid: authUid } : {})
      };

      await setDoc(doc(db, 'staff', id), finalStaff);
      setIsAddingStaff(false);
      setSuccessMessage(createAccount ? 'Staff member added and login account created with default password: Welcome@CCS2025' : 'Staff member added successfully!');
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, OperationType.CREATE, `staff/${id}`));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStaff = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canManageStaff || submitting || !profile?.companyId || !editingStaff) return;

    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const email = (formData.get('email') as string)?.toLowerCase();
    const role = formData.get('role') as Staff['role'];
    const warehouseId = formData.get('warehouseId') as string;

    const updatedStaff: Staff = {
      ...editingStaff,
      name: formData.get('name') as string,
      role,
      phone: formData.get('phone') as string,
      salary: Number(formData.get('salary')),
      allowances: Number(formData.get('allowances') || 0),
      bankName: formData.get('bankName') as string,
      accountNumber: formData.get('accountNumber') as string,
      ...(email ? { email } : { email: undefined }), // Use undefined here is still risky if we spread, but let's be safe
      ...(warehouseId ? { assignedWarehouseId: warehouseId } : { assignedWarehouseId: undefined })
    };

    // Remove undefined fields before sending to Firestore
    Object.keys(updatedStaff).forEach(key => {
      if ((updatedStaff as any)[key] === undefined) {
        delete (updatedStaff as any)[key];
      }
    });

    try {
      await setDoc(doc(db, 'staff', editingStaff.id), updatedStaff);
      setEditingStaff(null);
      setSuccessMessage('Staff member updated successfully!');
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, OperationType.UPDATE, `staff/${editingStaff.id}`));
    } finally {
      setSubmitting(false);
    }
  };

  const exportPayrollCSV = () => {
    if (filteredPayrolls.length === 0) return;

    const headers = ['Staff Name', 'Role', 'Basic Salary', 'Allowances', 'Gross Income', 'Pension', 'PAYE', 'Net Pay', 'Bank', 'Account Number'];
    const rows = filteredPayrolls.map(p => {
      const staff = staffList.find(s => s.id === p.staffId);
      return [
        staff?.name || 'Unknown',
        staff?.role || '',
        p.basicSalary,
        p.allowances,
        p.grossIncome,
        p.pension,
        p.paye,
        p.netPay,
        staff?.bankName || '',
        `'${staff?.accountNumber || ''}` // Prefix with ' to prevent Excel from stripping leading zeros
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Payroll_${selectedMonth}_${selectedWarehouseId}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const markAttendance = async (staffId: string, status: 'PRESENT' | 'ABSENT' | 'LATE') => {
    if (!isAccount && !isAdmin) return;
    if (submitting || !profile?.companyId) return;

    const staff = staffList.find(s => s.id === staffId);
    if (!staff) return;

    setSubmitting(true);
    const id = `${selectedDate}_${staffId}`;
    const record: Attendance = {
      id,
      companyId: profile.companyId,
      staffId,
      warehouseId: staff.assignedWarehouseId || 'GENERAL',
      date: selectedDate,
      status
    };
    try {
      await setDoc(doc(db, 'attendance', id), record);
      setSuccessMessage(`Attendance marked as ${status.toLowerCase()}!`);
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, OperationType.WRITE, `attendance/${id}`));
    } finally {
      setSubmitting(false);
    }
  };

  const updateRoster = async (staffId: string, shift: Roster['shift']) => {
    if (!isAccount && !isAdmin) return;
    if (submitting || !profile?.companyId) return;

    const staff = staffList.find(s => s.id === staffId);
    if (!staff) return;

    setSubmitting(true);
    const id = `${selectedDate}_${staffId}_roster`;
    const record: Roster = {
      id,
      companyId: profile.companyId,
      staffId,
      warehouseId: staff.assignedWarehouseId || 'GENERAL',
      date: selectedDate,
      shift
    };
    try {
      await setDoc(doc(db, 'rosters', id), record);
      setSuccessMessage(`Roster updated for ${staff.name}`);
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, OperationType.WRITE, `rosters/${id}`));
    } finally {
      setSubmitting(false);
    }
  };

  const updateStaffStatus = async (id: string, status: Staff['status']) => {
    if (!canManageStaff) return;
    try {
      await setDoc(doc(db, 'staff', id), { status }, { merge: true });
      setSuccessMessage(`Staff member status updated to ${status}`);
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, OperationType.UPDATE, `staff/${id}`));
    }
  };

  const deleteStaff = async (id: string) => {
    if (!canManageStaff) {
      setErrorMessage('You do not have permission to remove staff members.');
      return;
    }
    setDeleteConfirmId(id);
  };

  const confirmDeleteStaff = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteDoc(doc(db, 'staff', deleteConfirmId));
      setSuccessMessage('Staff member removed.');
    } catch (error) {
      setErrorMessage(reportFirestoreError(error, OperationType.DELETE, `staff/${deleteConfirmId}`));
    } finally {
      setDeleteConfirmId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
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
        {deleteConfirmId && (
          <ConfirmModal
            isOpen={true}
            title="Remove Staff"
            message="Are you sure you want to remove this staff member?"
            onConfirm={confirmDeleteStaff}
            onCancel={() => setDeleteConfirmId(null)}
            confirmText="Remove"
            type="danger"
          />
        )}
      </AnimatePresence>

      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Staff Management</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{company?.name}</p>
          </div>
          {canManageStaff && (
            <button
              onClick={() => setIsAddingStaff(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-sm font-bold active:scale-95 transition-all"
            >
              <Plus size={18} /> Add Staff
            </button>
          )}
        </div>

        <div className="flex gap-4 border-b border-slate-100">
          <button
            onClick={() => setActiveTab('roster')}
            className={cn(
              "pb-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2",
              activeTab === 'roster' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400"
            )}
          >
            Staff Roster
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={cn(
              "pb-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2",
              activeTab === 'attendance' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400"
            )}
          >
            Attendance
          </button>
          <button
            onClick={() => setActiveTab('payroll')}
            className={cn(
              "pb-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2",
              activeTab === 'payroll' ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400"
            )}
          >
            Payroll
          </button>
        </div>

        <div className="mt-4 flex items-center gap-4 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 shrink-0">
            <Building2 size={14} className="text-slate-400" />
            <select 
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="text-xs font-bold text-slate-600 bg-slate-50 border-none outline-none focus:ring-0"
              disabled={!!profile?.assignedWarehouseId}
            >
              <option value="ALL">All Warehouses</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          {activeTab !== 'payroll' && (
            <div className="flex items-center gap-2 shrink-0">
              <Calendar size={14} className="text-slate-400" />
              <input 
                type="date" 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-xs font-bold text-slate-600 bg-slate-50 border-none outline-none focus:ring-0"
              />
            </div>
          )}
          {activeTab === 'payroll' && (
            <div className="flex items-center gap-2 shrink-0">
              <Calendar size={14} className="text-slate-400" />
              <input 
                type="month" 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="text-xs font-bold text-slate-600 bg-slate-50 border-none outline-none focus:ring-0"
              />
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
        <AnimatePresence mode="wait">
          {isAddingStaff || editingStaff ? (
            <motion.div
              key="staff-form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold">{editingStaff ? 'Edit Staff Member' : 'New Staff Member'}</h2>
                <button onClick={() => { setIsAddingStaff(false); setEditingStaff(null); }} className="text-slate-400">Cancel</button>
              </div>
              <form onSubmit={editingStaff ? handleUpdateStaff : handleAddStaff} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Full Name</label>
                  <input 
                    required 
                    name="name" 
                    defaultValue={editingStaff?.name}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" 
                    placeholder="e.g. John Doe" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Role</label>
                    <select 
                      required 
                      name="role" 
                      defaultValue={editingStaff?.role || 'STAFF'}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium"
                    >
                      <option value="STAFF">Staff</option>
                      <option value="ACCOUNT">Account/Finance</option>
                      <option value="MANAGER">Manager</option>
                      <option value="AUDITOR">Auditor</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Assigned Warehouse</label>
                    <select 
                      name="warehouseId" 
                      defaultValue={editingStaff?.assignedWarehouseId || profile?.assignedWarehouseId || ''}
                      disabled={!!profile?.assignedWarehouseId && !isAdmin}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium disabled:opacity-50"
                    >
                      <option value="">All Warehouses</option>
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Phone</label>
                    <input 
                      required 
                      name="phone" 
                      defaultValue={editingStaff?.phone}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" 
                      placeholder="080..." 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Monthly Basic Salary (₦)</label>
                    <input 
                      required 
                      name="salary" 
                      type="number" 
                      defaultValue={editingStaff?.salary}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold" 
                      placeholder="0.00" 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Monthly Allowances (₦)</label>
                    <input 
                      name="allowances" 
                      type="number" 
                      defaultValue={editingStaff?.allowances}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold" 
                      placeholder="0.00" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bank Name</label>
                    <input 
                      name="bankName" 
                      defaultValue={editingStaff?.bankName}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" 
                      placeholder="e.g. GTBank" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Account Number</label>
                  <input 
                    name="accountNumber" 
                    defaultValue={editingStaff?.accountNumber}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" 
                    placeholder="0123456789" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Email (Optional for Login)</label>
                  <input 
                    name="email" 
                    type="email" 
                    defaultValue={editingStaff?.email}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" 
                    placeholder="staff@example.com" 
                  />
                </div>
                {!editingStaff && (
                  <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                    <input 
                      type="checkbox" 
                      id="createAccount" 
                      name="createAccount" 
                      className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="createAccount" className="text-xs font-bold text-indigo-900 cursor-pointer">
                      Create Login Account (Default Password: Welcome@CCS2025)
                    </label>
                  </div>
                )}
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? 'Saving...' : editingStaff ? 'Update Staff' : 'Save Staff'}
                </button>
              </form>
            </motion.div>
          ) : activeTab === 'roster' ? (
            <div className="space-y-3">
              {filteredStaff.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 border border-dashed border-slate-300 text-center">
                  <Users className="mx-auto text-slate-200 mb-2" size={48} />
                  <p className="text-sm text-slate-400">No staff members found for this warehouse</p>
                </div>
              ) : (
                filteredStaff.map(staff => {
                  const roster = rosters.find(r => r.staffId === staff.id && r.date === selectedDate);
                  return (
                    <div key={staff.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm group">
                      <div className="flex justify-between items-start">
                        <div className="flex gap-3">
                          <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg">
                            {staff.name.charAt(0)}
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900 flex items-center gap-2">
                              {staff.name}
                              {staff.uid && (
                                <span className="bg-emerald-50 text-emerald-600 text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-tighter flex items-center gap-0.5">
                                  <Lock size={8} /> Login Enabled
                                </span>
                              )}
                              {staff.status !== 'ACTIVE' && (
                                <span className={cn(
                                  "text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-tighter flex items-center gap-0.5",
                                  staff.status === 'SUSPENDED' ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
                                )}>
                                  {staff.status === 'SUSPENDED' ? <Clock size={8} /> : <XCircle size={8} />} {staff.status}
                                </span>
                              )}
                            </h3>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                              <span className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                                <Briefcase size={10} /> {staff.role}
                              </span>
                              <span className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                                <Phone size={10} /> {staff.phone}
                              </span>
                              {staff.assignedWarehouseId && (
                                <span className="flex items-center gap-1 text-[10px] text-indigo-500 font-bold">
                                  <Building2 size={10} /> {warehouses.find(w => w.id === staff.assignedWarehouseId)?.name || 'Store'}
                                </span>
                              )}
                            </div>
                            <div className="mt-3 flex gap-2">
                              {(['MORNING', 'AFTERNOON', 'NIGHT', 'OFF'] as const).map(shift => (
                                <button
                                  key={shift}
                                  onClick={() => updateRoster(staff.id, shift)}
                                  className={cn(
                                    "px-2 py-1 rounded text-[8px] font-black uppercase tracking-tighter transition-all",
                                    roster?.shift === shift 
                                      ? "bg-indigo-600 text-white shadow-md scale-105" 
                                      : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                                  )}
                                >
                                  {shift}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-slate-900">₦{((staff.salary || 0) + (staff.allowances || 0)).toLocaleString()}</p>
                          <p className="text-[9px] text-slate-400 uppercase">Gross Salary</p>
                          {canManageStaff && (
                            <div className="flex items-center justify-end gap-2 mt-2">
                              {staff.status === 'ACTIVE' ? (
                                <button 
                                  onClick={() => updateStaffStatus(staff.id, 'SUSPENDED')}
                                  title="Suspend Staff"
                                  className="text-slate-300 hover:text-amber-600 transition-colors opacity-0 group-hover:opacity-100"
                                >
                                  <UserMinus size={14} />
                                </button>
                              ) : staff.status === 'SUSPENDED' ? (
                                <button 
                                  onClick={() => updateStaffStatus(staff.id, 'ACTIVE')}
                                  title="Recall Staff"
                                  className="text-slate-300 hover:text-emerald-600 transition-colors opacity-0 group-hover:opacity-100"
                                >
                                  <UserCheck size={14} />
                                </button>
                              ) : null}
                              
                              {staff.status !== 'DISMISSED' && (
                                <button 
                                  onClick={() => updateStaffStatus(staff.id, 'DISMISSED')}
                                  title="Dismiss Staff"
                                  className="text-slate-300 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100"
                                >
                                  <UserX size={14} />
                                </button>
                              )}

                              <button 
                                onClick={() => setEditingStaff(staff)}
                                title="Edit Staff"
                                className="text-slate-300 hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <FileText size={14} />
                              </button>
                              <button 
                                onClick={() => deleteStaff(staff.id)}
                                title="Delete Staff"
                                className="text-slate-300 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : activeTab === 'attendance' ? (
            <div className="space-y-6">
              <div className="space-y-3">
                {filteredStaff.length === 0 ? (
                  <div className="bg-white rounded-2xl p-12 border border-dashed border-slate-300 text-center">
                    <Users className="mx-auto text-slate-200 mb-2" size={48} />
                    <p className="text-sm text-slate-400">No staff members found for this warehouse</p>
                  </div>
                ) : (
                  filteredStaff.map(staff => {
                    const record = attendance.find(a => a.staffId === staff.id && a.date === selectedDate);
                    const roster = rosters.find(r => r.staffId === staff.id && r.date === selectedDate);
                    return (
                      <div key={staff.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div>
                          <h3 className="font-bold text-slate-900">{staff.name}</h3>
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] text-slate-400 uppercase tracking-tighter">{staff.role}</p>
                            {roster && (
                              <span className="text-[8px] bg-indigo-50 text-indigo-600 px-1 rounded font-black uppercase">
                                {roster.shift}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {staff.status === 'ACTIVE' ? (
                            <>
                              <button 
                                onClick={() => markAttendance(staff.id, 'PRESENT')}
                                className={cn(
                                  "p-2 rounded-lg transition-all",
                                  record?.status === 'PRESENT' ? "bg-emerald-100 text-emerald-600" : "bg-slate-50 text-slate-300"
                                )}
                              >
                                <CheckCircle2 size={20} />
                              </button>
                              <button 
                                onClick={() => markAttendance(staff.id, 'LATE')}
                                className={cn(
                                  "p-2 rounded-lg transition-all",
                                  record?.status === 'LATE' ? "bg-amber-100 text-amber-600" : "bg-slate-50 text-slate-300"
                                )}
                              >
                                <Clock size={20} />
                              </button>
                              <button 
                                onClick={() => markAttendance(staff.id, 'ABSENT')}
                                className={cn(
                                  "p-2 rounded-lg transition-all",
                                  record?.status === 'ABSENT' ? "bg-rose-100 text-rose-600" : "bg-slate-50 text-slate-300"
                                )}
                              >
                                <XCircle size={20} />
                              </button>
                            </>
                          ) : (
                            <span className={cn(
                              "text-[10px] px-3 py-2 rounded-xl font-black uppercase tracking-tighter flex items-center gap-1.5",
                              staff.status === 'SUSPENDED' ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
                            )}>
                              {staff.status === 'SUSPENDED' ? <Clock size={14} /> : <XCircle size={14} />} {staff.status}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex-1 mr-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Total Payroll Cost</p>
                      <p className="text-xl font-black text-slate-900">
                        ₦{filteredPayrolls.reduce((sum, p) => sum + p.netPay, 0).toLocaleString()}
                      </p>
                    </div>
                    <Calculator className="text-indigo-600" size={24} />
                  </div>
                </div>
                <div className="flex gap-2">
                  {(isAdmin || isAccount) && (
                    <button
                      onClick={exportPayrollCSV}
                      className="bg-white text-slate-600 border border-slate-200 px-4 py-4 rounded-2xl font-bold shadow-sm flex items-center gap-2 active:scale-95 transition-all"
                    >
                      <Download size={18} />
                    </button>
                  )}
                  {(isAdmin || isAccount) && (
                    <button
                      onClick={generatePayroll}
                      disabled={submitting}
                      className="bg-indigo-600 text-white px-6 py-4 rounded-2xl font-bold shadow-lg flex items-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                    >
                      <CreditCard size={18} /> Generate
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">Staff</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">Gross</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">Pension</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">PAYE</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase text-right">Net Pay</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPayrolls.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-12 text-center text-slate-400 text-sm">
                            No payroll data for this month. Click generate to compute.
                          </td>
                        </tr>
                      ) : (
                        filteredPayrolls.map(p => {
                          const staff = staffList.find(s => s.id === p.staffId);
                          return (
                            <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-4">
                                <p className="font-bold text-slate-900 text-sm">{staff?.name || 'Unknown'}</p>
                                <p className="text-[9px] text-slate-400 uppercase">{staff?.role}</p>
                              </td>
                              <td className="px-4 py-4 text-xs font-medium text-slate-600">₦{p.grossIncome.toLocaleString()}</td>
                              <td className="px-4 py-4 text-xs font-medium text-rose-500">-₦{p.pension.toLocaleString()}</td>
                              <td className="px-4 py-4 text-xs font-medium text-rose-500">-₦{p.paye.toLocaleString()}</td>
                              <td className="px-4 py-4 text-sm font-black text-indigo-600 text-right">₦{p.netPay.toLocaleString()}</td>
                              <td className="px-4 py-4 text-right">
                                <button 
                                  onClick={() => setViewingPayroll(p)}
                                  className="text-slate-400 hover:text-indigo-600 transition-colors"
                                >
                                  <FileText size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                <div className="flex gap-3">
                  <FileText className="text-amber-600 shrink-0" size={20} />
                  <div>
                    <h4 className="text-sm font-bold text-amber-900">Nigerian Tax Compliance</h4>
                    <p className="text-xs text-amber-700 mt-1">
                      Calculations include Consolidated Relief Allowance (CRA), 8% Pension contribution, and progressive PAYE rates (7% to 24%). Minimum tax of 1% applied where applicable.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* Payslip Modal */}
      <AnimatePresence>
        {viewingPayroll && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4"
            onClick={() => setViewingPayroll(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="bg-indigo-600 p-6 text-white text-center">
                <h2 className="text-xl font-black uppercase tracking-widest">Payslip</h2>
                <p className="text-indigo-100 text-xs mt-1 font-bold">{viewingPayroll.month}</p>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {staffList.find(s => s.id === viewingPayroll.staffId)?.name}
                    </h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                      {staffList.find(s => s.id === viewingPayroll.staffId)?.role}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Net Pay</p>
                    <p className="text-xl font-black text-indigo-600">₦{viewingPayroll.netPay.toLocaleString()}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Basic Salary</span>
                    <span className="font-bold text-slate-900">₦{viewingPayroll.basicSalary.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Allowances</span>
                    <span className="font-bold text-slate-900">₦{viewingPayroll.allowances.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-slate-50">
                    <span className="font-bold text-slate-900">Gross Income</span>
                    <span className="font-bold text-slate-900">₦{viewingPayroll.grossIncome.toLocaleString()}</span>
                  </div>
                </div>

                <div className="space-y-3 bg-slate-50 p-4 rounded-2xl">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Deductions</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Pension (8%)</span>
                    <span className="font-bold text-rose-500">-₦{viewingPayroll.pension.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">PAYE Tax</span>
                    <span className="font-bold text-rose-500">-₦{viewingPayroll.paye.toLocaleString()}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-dashed border-slate-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Bank Account</p>
                      <p className="text-sm font-bold text-slate-700">
                        {staffList.find(s => s.id === viewingPayroll.staffId)?.bankName || 'N/A'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {staffList.find(s => s.id === viewingPayroll.staffId)?.accountNumber || 'N/A'}
                      </p>
                    </div>
                    <button 
                      onClick={() => window.print()}
                      className="bg-slate-100 text-slate-600 p-3 rounded-xl hover:bg-slate-200 transition-colors"
                    >
                      <Download size={20} />
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => setViewingPayroll(null)}
                  className="w-full py-4 text-slate-400 font-bold text-sm hover:text-slate-600 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
