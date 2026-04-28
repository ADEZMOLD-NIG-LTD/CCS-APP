/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { db, firebaseConfig } from '../firebase';
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
import { collection, onSnapshot, doc, setDoc, query, orderBy, deleteDoc, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, reportFirestoreError, formatFirestoreError, OperationType } from '../lib/firestore';
import { cn } from '../lib/utils';
import Toast from './Toast';
import ConfirmModal from './ConfirmModal';

import { sendOnboardingEmail } from '../services/emailService';

// Sub-components
import StaffForm from './staff/StaffForm';
import RosterManager from './staff/RosterManager';
import AttendanceManager from './staff/AttendanceManager';
import PayrollManager from './staff/PayrollManager';
import PayslipModal from './staff/PayslipModal';

export default function StaffModule() {
  const { profile, company, isAdmin, isAccount, canManageStaff, isOnline } = useAuth();
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [viewingPayroll, setViewingPayroll] = useState<Payroll | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
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
        const payrollRecord: any = {
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

        // Clean up undefined values
        Object.keys(payrollRecord).forEach(key => payrollRecord[key] === undefined && delete payrollRecord[key]);

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
      const defaultPassword = 'welcome@2025';

      // If requested, create a Firebase Auth account with a default password
      if (createAccount && email) {
        const secondaryApp = getApps().find(app => app.name === 'Secondary') || initializeApp(firebaseConfig, 'Secondary');
        const secondaryAuth = getAuth(secondaryApp);
        
        try {
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, defaultPassword);
          authUid = userCredential.user.uid;
          await signOut(secondaryAuth);

          // Send Onboarding Email (non-blocking but we'll notify if it fails)
          try {
            await sendOnboardingEmail({
              email,
              name: newStaff.name,
              password: defaultPassword,
              companyName: company?.name
            });
            setSuccessMessage(`Staff member added and onboarding email sent to ${email}`);
          } catch (emailErr: any) {
            console.error('Failed to send onboarding email:', emailErr);
            setSuccessMessage(`System: Staff added, but EMAIL FAILED (${emailErr.message || 'Check SMTP'}). Share manually -> Email: ${email}, Password: ${defaultPassword}`);
          }
        } catch (authError: any) {
          if (authError.code === 'auth/email-already-in-use') {
            // Account already exists, just link it
            console.log('Auth account already exists for this email.');
          } else {
            throw authError;
          }
        }
      }

      const finalStaff: any = {
        ...newStaff,
        ...(authUid ? { uid: authUid } : {})
      };

      // Clean up undefined values
      Object.keys(finalStaff).forEach(key => finalStaff[key] === undefined && delete finalStaff[key]);

      const writePromise = setDoc(doc(db, 'staff', id), finalStaff);
      
      if (!isOnline) {
        console.log('Working offline, proceeding optimistically');
      } else {
        await writePromise;
      }

      setIsAddingStaff(false);
      if (!createAccount) {
        setSuccessMessage('Staff member added successfully!');
      }
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
      const writePromise = setDoc(doc(db, 'staff', editingStaff.id), updatedStaff);
      
      if (!isOnline) {
        console.log('Working offline, proceeding optimistically');
      } else {
        await writePromise;
      }

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
    const record: any = {
      id,
      companyId: profile.companyId,
      staffId,
      warehouseId: staff.assignedWarehouseId || 'GENERAL',
      date: selectedDate,
      status
    };

    // Clean up undefined values
    Object.keys(record).forEach(key => record[key] === undefined && delete record[key]);

    try {
      const writePromise = setDoc(doc(db, 'attendance', id), record);
      
      if (!isOnline) {
        console.log('Working offline, proceeding optimistically');
      } else {
        await writePromise;
      }

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
    const record: any = {
      id,
      companyId: profile.companyId,
      staffId,
      warehouseId: staff.assignedWarehouseId || 'GENERAL',
      date: selectedDate,
      shift
    };

    // Clean up undefined values
    Object.keys(record).forEach(key => record[key] === undefined && delete record[key]);

    try {
      const writePromise = setDoc(doc(db, 'rosters', id), record);
      
      if (!isOnline) {
        console.log('Working offline, proceeding optimistically');
      } else {
        await writePromise;
      }

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
      const writePromise = setDoc(doc(db, 'staff', id), { status }, { merge: true });
      
      if (!isOnline) {
        console.log('Working offline, proceeding optimistically');
      } else {
        await writePromise;
      }

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

  const handleTestEmail = async () => {
    if (!profile?.email || testingEmail) return;
    setTestingEmail(true);
    try {
      await sendOnboardingEmail({
        email: profile.email,
        name: profile.displayName || 'Admin User',
        password: 'TestPassword123!',
        companyName: company?.name || 'CCS Test'
      });
      setSuccessMessage(`Test email sent to ${profile.email}. Please check your inbox (and spam folder).`);
    } catch (error) {
      setErrorMessage('Failed to send test email. Please verify your SMTP settings in the Secrets panel.');
      console.error(error);
    } finally {
      setTestingEmail(false);
    }
  };

  const confirmDeleteStaff = async () => {
    if (!deleteConfirmId) return;
    try {
      const writePromise = deleteDoc(doc(db, 'staff', deleteConfirmId));
      
      if (!isOnline) {
        console.log('Working offline, proceeding optimistically');
      } else {
        await writePromise;
      }

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
            <div className="flex items-center gap-2">
              {isAdmin && (
                <button
                  onClick={handleTestEmail}
                  disabled={testingEmail}
                  className="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl border border-slate-200 flex items-center gap-2 text-sm font-bold active:scale-95 transition-all disabled:opacity-50"
                  title="Send a test onboarding email to yourself"
                >
                  <Mail size={18} /> {testingEmail ? 'Sending...' : 'Test Email'}
                </button>
              )}
              <button
                onClick={() => setIsAddingStaff(true)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-sm font-bold active:scale-95 transition-all"
              >
                <Plus size={18} /> Add Staff
              </button>
            </div>
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
            <StaffForm
              key="staff-form"
              editingStaff={editingStaff}
              warehouses={warehouses}
              profile={profile}
              company={company}
              isAdmin={isAdmin}
              submitting={submitting}
              onCancel={() => { setIsAddingStaff(false); setEditingStaff(null); }}
              onSubmit={editingStaff ? handleUpdateStaff : handleAddStaff}
            />
          ) : activeTab === 'roster' ? (
            <RosterManager
              key="roster-manager"
              filteredStaff={filteredStaff}
              rosters={rosters}
              warehouses={warehouses}
              selectedDate={selectedDate}
              canManageStaff={canManageStaff}
              onUpdateRoster={updateRoster}
              onUpdateStatus={updateStaffStatus}
              onEdit={setEditingStaff}
              onDelete={deleteStaff}
            />
          ) : activeTab === 'attendance' ? (
            <AttendanceManager
              key="attendance-manager"
              filteredStaff={filteredStaff}
              attendance={attendance}
              rosters={rosters}
              selectedDate={selectedDate}
              onMarkAttendance={markAttendance}
            />
          ) : (
            <PayrollManager
              key="payroll-manager"
              filteredPayrolls={filteredPayrolls}
              staffList={staffList}
              isAdmin={isAdmin}
              isAccount={isAccount}
              submitting={submitting}
              onExportCSV={exportPayrollCSV}
              onGenerate={generatePayroll}
              onViewPayslip={setViewingPayroll}
            />
          )}
        </AnimatePresence>
      </main>

      <PayslipModal
        viewingPayroll={viewingPayroll}
        staffList={staffList}
        onClose={() => setViewingPayroll(null)}
      />
    </div>
  );
}
