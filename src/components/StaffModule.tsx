/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Calendar, Plus } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '../firebase';
import { collection, onSnapshot, query, serverTimestamp, where } from '../lib/fs';
import { useAuth } from '../contexts/AuthContext';
import { useActiveCollection, useCompanyCollection, useWarehouses } from '../contexts/CompanyDataContext';
import { useCommit } from '../hooks/useCommit';
import { AuditAction, auditOp } from '../lib/audit';
import { canAssignRole } from '../lib/permissions';
import { computeMonthlyPayroll } from '../lib/finance';
import { currentMonthLocal, localDateToIso, todayLocal } from '../lib/dates';
import { downloadCsv } from '../lib/csv';
import { logger } from '../lib/logger';
import { cn, formatCurrency, isValidEmail, newId, normalizeEmail, roundTo, toNumber } from '../lib/utils';
import type { WriteOp } from '../lib/writes';
import { provisionStaffLogin } from '../lib/staffAccess';
import { sendWelcomeEmail } from '../services/emailService';
import type { Invite, Payroll, Roster, Staff, UserProfile } from '../types';
import ConfirmModal from './ConfirmModal';
import StaffForm, { type StaffFormValues } from './staff/StaffForm';
import RosterManager from './staff/RosterManager';
import AttendanceManager from './staff/AttendanceManager';
import PayrollManager from './staff/PayrollManager';
import PayslipModal from './staff/PayslipModal';

type Tab = 'roster' | 'attendance' | 'payroll';

const USER_STATUS_FOR: Record<Staff['status'], UserProfile['status']> = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  INACTIVE: 'SUSPENDED',
  DISMISSED: 'DISMISSED',
};

export default function StaffModule() {
  const { profile, company, role, can, auditActor, isDemoMode, setErrorMessage, setSuccessMessage } = useAuth();
  const { commit, busy } = useCommit();
  const staffState = useActiveCollection('staff');
  const attendanceState = useCompanyCollection('attendance');
  const rosterState = useCompanyCollection('rosters');
  const payrollState = useCompanyCollection('payrolls', can('view_payroll'));
  const { data: warehouses } = useWarehouses();

  const canManageStaff = can('manage_staff');
  const canManageAttendance = can('manage_attendance');
  const canManagePayroll = can('manage_payroll');

  const [invites, setInvites] = useState<Invite[]>([]);
  const [companyUsers, setCompanyUsers] = useState<UserProfile[]>([]);
  const [tab, setTab] = useState<Tab>('roster');
  const [isAdding, setIsAdding] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Staff | null>(null);
  const [viewingPayroll, setViewingPayroll] = useState<Payroll | null>(null);
  const [editingDeduction, setEditingDeduction] = useState<Payroll | null>(null);
  const [deductionAmount, setDeductionAmount] = useState('');
  const [deductionNote, setDeductionNote] = useState('');
  const [payTargets, setPayTargets] = useState<Payroll[] | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayLocal());
  const [selectedMonth, setSelectedMonth] = useState(currentMonthLocal());
  const lockedWarehouse = role !== 'ADMIN' && profile?.assignedWarehouseId ? profile.assignedWarehouseId : null;
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(lockedWarehouse || 'ALL');

  const companyId = profile?.companyId ?? '';

  useEffect(() => {
    if (!companyId || !canManageStaff) return;
    const unsubInvites = onSnapshot(
      query(collection(db, 'invites'), where('companyId', '==', companyId)),
      snapshot => setInvites(snapshot.docs.map(d => ({ ...(d.data() as Invite), id: d.id }))),
      error => logger.warn('Invites unavailable', error)
    );
    const unsubUsers = onSnapshot(
      query(collection(db, 'users'), where('companyId', '==', companyId)),
      snapshot => setCompanyUsers(snapshot.docs.map(d => ({ ...(d.data() as UserProfile), uid: d.id }))),
      error => logger.warn('Company users unavailable', error)
    );
    return () => {
      unsubInvites();
      unsubUsers();
    };
  }, [companyId, canManageStaff]);

  const staffList = useMemo(() => [...staffState.data].sort((a, b) => a.name.localeCompare(b.name)), [staffState.data]);
  const filteredStaff = useMemo(
    () => (selectedWarehouseId === 'ALL' ? staffList : staffList.filter(s => s.assignedWarehouseId === selectedWarehouseId)),
    [staffList, selectedWarehouseId]
  );
  const invitesByEmail = useMemo(() => {
    const map: Record<string, Invite> = {};
    invites.forEach(inv => {
      if (inv.status === 'PENDING') map[inv.email] = inv;
    });
    return map;
  }, [invites]);
  const usersById = useMemo(() => Object.fromEntries(companyUsers.map(u => [u.uid, u])), [companyUsers]);

  const monthPayrolls = useMemo(() => {
    const staffIds = new Set(filteredStaff.map(s => s.id));
    return payrollState.data.filter(p => p.month === selectedMonth && (selectedWarehouseId === 'ALL' || staffIds.has(p.staffId)));
  }, [payrollState.data, selectedMonth, filteredStaff, selectedWarehouseId]);

  if (!auditActor || !company) return null;
  const actor = auditActor;
  const nowIso = () => new Date().toISOString();

  // ------------------------------------------------------------------ staff records

  const inviteOp = (staff: Pick<Staff, 'id' | 'role' | 'assignedWarehouseId'>, email: string): WriteOp => {
    const id = `${companyId}__${email}`;
    return {
      kind: 'set',
      collection: 'invites',
      id,
      data: {
        id,
        companyId,
        companyName: company.name,
        email,
        role: staff.role,
        staffId: staff.id,
        assignedWarehouseId: staff.assignedWarehouseId || null,
        status: 'PENDING',
        invitedByUid: actor.uid,
        invitedByEmail: actor.email,
        createdAt: nowIso(),
      },
    };
  };

  const deliverInvite = async (email: string, name: string) => {
    if (isDemoMode) {
      setSuccessMessage('Staff saved. Login invitations are not sent in training mode.');
      return;
    }
    try {
      const result = await provisionStaffLogin(email);
      sendWelcomeEmail({ email, name, companyId }).catch(() => undefined);
      setSuccessMessage(
        result === 'created'
          ? `Invitation ready. ${email} will receive an email to set their password, then sign in to join ${company.name}.`
          : `${email} already has an account. They can sign in and accept the invitation to join ${company.name}.`
      );
    } catch (error) {
      logger.error('Login provisioning failed', error);
      setErrorMessage(`Staff saved, but the login email could not be sent (${(error as Error).message}). Use “Send password email” to retry.`);
    }
  };

  const validate = (values: StaffFormValues, existing?: Staff): string | null => {
    if (!values.name.trim()) return 'Enter the staff member’s name.';
    if (!values.phone.trim()) return 'Enter a phone number.';
    if (values.salary < 0 || values.allowances < 0 || values.annualRent < 0) return 'Salary, allowances and rent cannot be negative.';
    if (values.email && !isValidEmail(values.email)) return 'Enter a valid email address.';
    if (values.grantAccess && !values.email) return 'An email address is required to give this person a login.';
    if (!canAssignRole(role, values.role)) return 'You cannot assign that role.';
    if (existing && existing.role === 'ADMIN' && role !== 'ADMIN') return 'Only an Admin can edit another Admin.';
    if (values.email && staffList.some(s => s.id !== existing?.id && normalizeEmail(s.email) === values.email)) {
      return 'Another staff member already uses this email.';
    }
    return null;
  };

  const handleSave = async (values: StaffFormValues) => {
    const problem = validate(values, editingStaff ?? undefined);
    if (problem) {
      setErrorMessage(problem);
      return;
    }

    const base = {
      companyId,
      name: values.name.trim(),
      role: values.role,
      phone: values.phone.trim(),
      salary: roundTo(values.salary, 2),
      allowances: roundTo(values.allowances, 2),
      annualRent: roundTo(values.annualRent, 2),
      bankName: values.bankName.trim(),
      accountNumber: values.accountNumber.trim(),
      accountName: values.accountName.trim(),
      applyPAYE: values.applyPAYE,
      applyPension: values.applyPension,
      email: values.email || null,
      assignedWarehouseId: values.assignedWarehouseId || null,
      updatedAt: nowIso(),
    };

    if (editingStaff) {
      const ops: WriteOp[] = [
        { kind: 'update', collection: 'staff', id: editingStaff.id, data: base },
      ];
      if (editingStaff.uid && usersById[editingStaff.uid] && editingStaff.uid !== actor.uid) {
        ops.push({ kind: 'update', collection: 'users', id: editingStaff.uid, data: { role: values.role, assignedWarehouseId: values.assignedWarehouseId || null, updatedAt: nowIso() } });
      }
      const oldEmail = normalizeEmail(editingStaff.email);
      const pending = oldEmail ? invitesByEmail[oldEmail] : undefined;
      if (pending && oldEmail !== values.email) {
        ops.push({ kind: 'update', collection: 'invites', id: pending.id, data: { status: 'REVOKED' } });
      } else if (pending) {
        ops.push({ kind: 'update', collection: 'invites', id: pending.id, data: { role: values.role, assignedWarehouseId: values.assignedWarehouseId || null } });
      }
      const shouldInvite = values.grantAccess && values.email && !editingStaff.uid && (!pending || oldEmail !== values.email);
      if (shouldInvite) ops.push(inviteOp({ id: editingStaff.id, role: values.role, assignedWarehouseId: values.assignedWarehouseId }, values.email));
      ops.push(auditOp(actor, { action: AuditAction.UPDATE, module: 'Staff', recordId: editingStaff.id, details: `Updated staff ${base.name}`, previousData: editingStaff, newData: base }));

      if (await commit(ops, { success: shouldInvite ? undefined : 'Staff member updated.', context: 'staff' })) {
        setEditingStaff(null);
        if (shouldInvite) await deliverInvite(values.email, base.name);
      }
      return;
    }

    const id = newId();
    const record = { ...base, id, joinedDate: nowIso(), status: 'ACTIVE' as const, createdAt: nowIso() };
    const ops: WriteOp[] = [{ kind: 'set', collection: 'staff', id, data: record }];
    const invite = values.grantAccess && !!values.email;
    if (invite) ops.push(inviteOp({ id, role: values.role, assignedWarehouseId: values.assignedWarehouseId }, values.email));
    ops.push(auditOp(actor, { action: AuditAction.CREATE, module: 'Staff', recordId: id, details: `Added staff ${record.name} (${record.role})`, newData: record }));

    if (await commit(ops, { success: invite ? undefined : 'Staff member added.', context: 'staff' })) {
      setIsAdding(false);
      if (invite) await deliverInvite(values.email, record.name);
    }
  };

  const updateStatus = async (staff: Staff, status: Staff['status']) => {
    if (staff.uid === actor.uid) {
      setErrorMessage('You cannot change your own access.');
      return;
    }
    if (staff.role === 'ADMIN' && role !== 'ADMIN') {
      setErrorMessage('Only an Admin can change another Admin’s status.');
      return;
    }
    const ops: WriteOp[] = [{ kind: 'update', collection: 'staff', id: staff.id, data: { status, updatedAt: nowIso() } }];
    if (staff.uid && usersById[staff.uid]) {
      ops.push({ kind: 'update', collection: 'users', id: staff.uid, data: { status: USER_STATUS_FOR[status], updatedAt: nowIso() } });
    }
    const pending = staff.email ? invitesByEmail[normalizeEmail(staff.email)] : undefined;
    if (pending && status !== 'ACTIVE') ops.push({ kind: 'update', collection: 'invites', id: pending.id, data: { status: 'REVOKED' } });
    ops.push(auditOp(actor, { action: AuditAction.UPDATE, module: 'Staff', recordId: staff.id, details: `Changed ${staff.name}'s status to ${status}` }));
    await commit(ops, { success: `${staff.name} is now ${status.toLowerCase()}.`, context: 'staff' });
  };

  const confirmDelete = async (reason?: string) => {
    const staff = deleteTarget;
    if (!staff || !reason?.trim()) return;
    if (staff.uid === actor.uid) {
      setErrorMessage('You cannot remove yourself.');
      return;
    }
    const ops: WriteOp[] = [{
      kind: 'update',
      collection: 'staff',
      id: staff.id,
      data: { isDeleted: true, deletionReason: reason.trim(), deletedBy: actor.email, deletedByUid: actor.uid, deletedAt: nowIso() },
    }];
    if (staff.uid && usersById[staff.uid]) {
      ops.push({ kind: 'update', collection: 'users', id: staff.uid, data: { status: 'DISMISSED', updatedAt: nowIso() } });
    }
    const pending = staff.email ? invitesByEmail[normalizeEmail(staff.email)] : undefined;
    if (pending) ops.push({ kind: 'update', collection: 'invites', id: pending.id, data: { status: 'REVOKED' } });
    ops.push(auditOp(actor, { action: AuditAction.DELETE, module: 'Staff', recordId: staff.id, details: `Removed staff ${staff.name}. Reason: ${reason.trim()}`, previousData: staff }));
    if (await commit(ops, { success: `${staff.name} removed and their access revoked.`, context: 'staff' })) {
      setDeleteTarget(null);
    }
  };

  const sendInvite = async (staff: Staff) => {
    const email = normalizeEmail(staff.email);
    if (!email) return;
    const ops: WriteOp[] = [];
    if (!invitesByEmail[email]) {
      ops.push(inviteOp(staff, email));
      ops.push(auditOp(actor, { action: AuditAction.CREATE, module: 'Staff', recordId: staff.id, details: `Invited ${email} to log in as ${staff.role}` }));
      if (!(await commit(ops, { context: 'invites' }))) return;
    }
    await deliverInvite(email, staff.name);
  };

  const sendPasswordEmail = async (staff: Staff) => {
    const email = normalizeEmail(staff.email);
    if (!email || !auth || isDemoMode) {
      setErrorMessage('Password emails are not available here.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email, { url: window.location.origin });
      setSuccessMessage(`Password email sent to ${email}.`);
    } catch (error) {
      setErrorMessage(`Could not send the email: ${(error as Error).message}`);
    }
  };

  const forcePasswordChange = async (staff: Staff) => {
    if (!staff.uid || !usersById[staff.uid] || staff.uid === actor.uid) return;
    await commit(
      [
        { kind: 'update', collection: 'users', id: staff.uid, data: { mustChangePassword: true, mustChangePasswordSetAt: serverTimestamp(), updatedAt: nowIso() } },
        auditOp(actor, { action: AuditAction.UPDATE, module: 'Staff', recordId: staff.id, details: `Required ${staff.name} to change password at next sign-in` }),
      ],
      { success: `${staff.name} must set a new password at their next sign-in.`, context: 'users' }
    );
  };

  // ------------------------------------------------------------------ roster & attendance

  const updateRoster = (staff: Staff, shift: Roster['shift']) => {
    const id = `${selectedDate}_${staff.id}_roster`;
    commit(
      [{ kind: 'set', collection: 'rosters', id, data: { id, companyId, staffId: staff.id, warehouseId: staff.assignedWarehouseId || 'GENERAL', date: selectedDate, shift } }],
      { context: 'rosters' }
    );
  };

  const markAttendance = (staff: Staff, status: 'PRESENT' | 'ABSENT' | 'LATE') => {
    const id = `${selectedDate}_${staff.id}`;
    commit(
      [{ kind: 'set', collection: 'attendance', id, data: { id, companyId, staffId: staff.id, warehouseId: staff.assignedWarehouseId || 'GENERAL', date: selectedDate, status } }],
      { context: 'attendance' }
    );
  };

  // ------------------------------------------------------------------ payroll

  const generatePayroll = async () => {
    const existing = new Map(payrollState.data.filter(p => p.month === selectedMonth).map(p => [p.staffId, p]));
    const ops: WriteOp[] = [];
    let skippedPaid = 0;
    for (const staff of filteredStaff) {
      if (staff.status !== 'ACTIVE') continue;
      const current = existing.get(staff.id);
      if (current?.status === 'PAID') {
        skippedPaid++;
        continue;
      }
      const figures = computeMonthlyPayroll({
        basicSalary: staff.salary,
        allowances: staff.allowances,
        applyPension: staff.applyPension !== false,
        applyPAYE: staff.applyPAYE !== false,
        annualRent: staff.annualRent,
        otherDeductions: current?.otherDeductions ?? 0,
        month: selectedMonth,
      });
      const id = `${selectedMonth}_${staff.id}`;
      ops.push({
        kind: 'set',
        collection: 'payrolls',
        id,
        data: {
          id,
          companyId,
          staffId: staff.id,
          month: selectedMonth,
          ...figures,
          deductionsNote: current?.deductionsNote ?? '',
          status: 'PENDING',
          createdAt: current?.createdAt ?? nowIso(),
          updatedAt: nowIso(),
        },
      });
    }
    if (ops.length === 0) {
      setErrorMessage(skippedPaid ? 'All payroll for this month is already paid.' : 'No active staff to generate payroll for.');
      return;
    }
    for (let i = 0; i < ops.length; i += 400) {
      const chunk = ops.slice(i, i + 400);
      if (i + 400 >= ops.length) {
        chunk.push(auditOp(actor, { action: AuditAction.CREATE, module: 'Payroll', recordId: selectedMonth, details: `Generated payroll for ${selectedMonth} (${ops.length} staff${skippedPaid ? `, ${skippedPaid} already paid` : ''})` }));
      }
      const ok = await commit(chunk, {
        success: i + 400 >= ops.length ? `Payroll for ${selectedMonth} is ready${skippedPaid ? ` (${skippedPaid} paid records left unchanged)` : ''}.` : undefined,
        context: 'payrolls',
      });
      if (!ok) return;
    }
  };

  const saveDeduction = async () => {
    const payroll = editingDeduction;
    if (!payroll) return;
    if (payroll.status === 'PAID') {
      setErrorMessage('Paid payroll cannot be changed.');
      return;
    }
    const amount = roundTo(Math.max(0, toNumber(deductionAmount)), 2);
    const netPay = roundTo(payroll.grossIncome - payroll.pension - payroll.paye - amount, 2);
    if (netPay < 0) {
      setErrorMessage('Deductions cannot exceed net pay.');
      return;
    }
    const ok = await commit(
      [
        { kind: 'update', collection: 'payrolls', id: payroll.id, data: { otherDeductions: amount, deductionsNote: deductionNote.trim(), netPay, updatedAt: nowIso() } },
        auditOp(actor, { action: AuditAction.UPDATE, module: 'Payroll', recordId: payroll.id, details: `Set other deductions to ${formatCurrency(amount)} for ${payroll.month}` }),
      ],
      { success: 'Deductions updated.', context: 'payrolls' }
    );
    if (ok) setEditingDeduction(null);
  };

  const payPayrolls = async (targets: Payroll[], method: 'CASH' | 'BANK_TRANSFER', warehouseId: string, date: string) => {
    const payable = targets.filter(p => p.status === 'PENDING' && p.netPay > 0);
    if (payable.length === 0) {
      setErrorMessage('Nothing to pay.');
      return;
    }
    const dateIso = localDateToIso(date);
    const ops: WriteOp[] = [];
    let total = 0;
    for (const payroll of payable) {
      const staff = staffList.find(s => s.id === payroll.staffId);
      const journalId = newId();
      total += payroll.netPay;
      ops.push({
        kind: 'set',
        collection: 'journal',
        id: journalId,
        data: {
          id: journalId,
          companyId,
          warehouseId: staff?.assignedWarehouseId || warehouseId,
          date: dateIso,
          postingDate: nowIso(),
          type: 'OUTFLOW',
          category: 'STAFF SALARY',
          amount: payroll.netPay,
          description: `Salary ${payroll.month} — ${staff?.name ?? payroll.staffId}`,
          paymentMethod: method,
          reference: payroll.id,
          source: 'PAYROLL',
          createdByUid: actor.uid,
        },
      });
      ops.push({ kind: 'update', collection: 'payrolls', id: payroll.id, data: { status: 'PAID', paidAt: dateIso, paidJournalId: journalId, updatedAt: nowIso() } });
    }
    ops.push(auditOp(actor, { action: AuditAction.UPDATE, module: 'Payroll', recordId: selectedMonth, details: `Paid ${payable.length} salaries totalling ${formatCurrency(total)} via ${method}` }));
    for (let i = 0; i < ops.length; i += 400) {
      const done = i + 400 >= ops.length;
      if (!(await commit(ops.slice(i, i + 400), { success: done ? `Recorded ${payable.length} salary payment(s) in the journal.` : undefined, context: 'payrolls' }))) return;
    }
    setPayTargets(null);
  };

  const exportPayrollCsv = () => {
    const rows = monthPayrolls.map(p => {
      const staff = staffList.find(s => s.id === p.staffId);
      return [
        staff?.name ?? 'Unknown', staff?.role ?? '', p.basicSalary, p.allowances, p.grossIncome, p.pension, p.paye,
        p.otherDeductions || 0, p.deductionsNote || '', p.netPay, p.status, p.taxRegime ?? '', staff?.bankName ?? '', staff?.accountName ?? '', staff?.accountNumber ?? '',
      ];
    });
    downloadCsv(`Payroll_${selectedMonth}.csv`,
      ['Staff Name', 'Role', 'Basic Salary', 'Allowances', 'Gross Income', 'Pension', 'PAYE', 'Other Deductions', 'Deductions Note', 'Net Pay', 'Status', 'Tax Regime', 'Bank', 'Account Name', 'Account Number'],
      rows);
  };

  const tabs: { id: Tab; label: string; visible: boolean }[] = [
    { id: 'roster', label: 'Staff Roster', visible: true },
    { id: 'attendance', label: 'Attendance', visible: true },
    { id: 'payroll', label: 'Payroll', visible: can('view_payroll') },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Remove staff member"
        message={`Remove ${deleteTarget?.name ?? 'this person'}? Their login access is revoked immediately. Payroll and attendance history is kept.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        confirmText="Remove"
        requireReason
      />

      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Staff Management</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{company.name}</p>
          </div>
          {canManageStaff && !isAdding && !editingStaff && (
            <button onClick={() => setIsAdding(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-sm font-bold active:scale-95">
              <Plus size={18} /> Add Staff
            </button>
          )}
        </div>

        <div className="flex gap-4 border-b border-slate-100">
          {tabs.filter(t => t.visible).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn('pb-2 text-xs font-bold uppercase tracking-wider border-b-2', tab === t.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400')}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-4 overflow-x-auto no-scrollbar">
          <label className="flex items-center gap-2 shrink-0">
            <Building2 size={14} className="text-slate-400" />
            <select
              value={selectedWarehouseId}
              onChange={e => setSelectedWarehouseId(e.target.value)}
              disabled={!!lockedWarehouse}
              className="text-xs font-bold text-slate-600 bg-slate-50 border-none outline-none"
            >
              <option value="ALL">All Warehouses</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 shrink-0">
            <Calendar size={14} className="text-slate-400" />
            {tab === 'payroll' ? (
              <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value || currentMonthLocal())} className="text-xs font-bold text-slate-600 bg-slate-50 border-none outline-none" />
            ) : (
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value || todayLocal())} className="text-xs font-bold text-slate-600 bg-slate-50 border-none outline-none" />
            )}
          </label>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
        <AnimatePresence mode="wait">
          {isAdding || editingStaff ? (
            <StaffForm
              key={editingStaff?.id ?? 'new'}
              editingStaff={editingStaff}
              warehouses={warehouses}
              actorRole={role}
              lockedWarehouseId={lockedWarehouse}
              hasLogin={!!editingStaff?.uid}
              submitting={busy}
              onCancel={() => { setIsAdding(false); setEditingStaff(null); }}
              onSubmit={handleSave}
            />
          ) : tab === 'roster' ? (
            <RosterManager
              key="roster"
              staff={filteredStaff}
              rosters={rosterState.data}
              warehouses={warehouses}
              selectedDate={selectedDate}
              actorRole={role}
              currentUid={actor.uid}
              canManageStaff={canManageStaff}
              canManageRoster={canManageAttendance}
              invitesByEmail={invitesByEmail}
              usersById={usersById}
              onUpdateRoster={updateRoster}
              onUpdateStatus={updateStatus}
              onInvite={sendInvite}
              onSendPasswordEmail={sendPasswordEmail}
              onForcePasswordChange={forcePasswordChange}
              onEdit={setEditingStaff}
              onDelete={setDeleteTarget}
            />
          ) : tab === 'attendance' ? (
            <AttendanceManager
              key="attendance"
              staff={filteredStaff}
              attendance={attendanceState.data}
              rosters={rosterState.data}
              selectedDate={selectedDate}
              canMark={canManageAttendance}
              onMarkAttendance={markAttendance}
            />
          ) : (
            <PayrollManager
              key="payroll"
              payrolls={monthPayrolls}
              staffList={staffList}
              month={selectedMonth}
              canManage={canManagePayroll}
              submitting={busy}
              onExportCSV={exportPayrollCsv}
              onGenerate={generatePayroll}
              onViewPayslip={setViewingPayroll}
              onEditDeductions={p => {
                setEditingDeduction(p);
                setDeductionAmount(p.otherDeductions ? String(p.otherDeductions) : '');
                setDeductionNote(p.deductionsNote || '');
              }}
              onPay={targets => setPayTargets(targets)}
            />
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {editingDeduction && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Other deductions</h3>
              <div className="space-y-4">
                <label className="block">
                  <span className="block text-xs font-bold text-slate-600 mb-1">Amount (₦)</span>
                  <input type="number" min="0" step="0.01" value={deductionAmount} onChange={e => setDeductionAmount(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm" />
                </label>
                <label className="block">
                  <span className="block text-xs font-bold text-slate-600 mb-1">Reason</span>
                  <input type="text" maxLength={200} value={deductionNote} onChange={e => setDeductionNote(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm" placeholder="e.g. Salary advance repayment" />
                </label>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setEditingDeduction(null)} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold text-sm">Cancel</button>
                <button onClick={saveDeduction} disabled={busy} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {payTargets && (
        <PayModal
          targets={payTargets}
          warehouses={warehouses}
          busy={busy}
          onCancel={() => setPayTargets(null)}
          onConfirm={(method, warehouseId, date) => payPayrolls(payTargets, method, warehouseId, date)}
        />
      )}

      <PayslipModal viewingPayroll={viewingPayroll} staffList={staffList} companyName={company.name} onClose={() => setViewingPayroll(null)} />
    </div>
  );
}

function PayModal({ targets, warehouses, busy, onCancel, onConfirm }: {
  targets: Payroll[];
  warehouses: { id: string; name: string }[];
  busy: boolean;
  onCancel: () => void;
  onConfirm: (method: 'CASH' | 'BANK_TRANSFER', warehouseId: string, date: string) => void;
}) {
  const [method, setMethod] = useState<'CASH' | 'BANK_TRANSFER'>('BANK_TRANSFER');
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '');
  const [date, setDate] = useState(todayLocal());
  const payable = targets.filter(p => p.status === 'PENDING' && p.netPay > 0);
  const total = payable.reduce((sum, p) => sum + p.netPay, 0);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-1">Record salary payment</h3>
        <p className="text-xs text-slate-500 mb-4">{payable.length} payment(s) totalling <strong>{formatCurrency(total)}</strong> will be posted to the journal and locked.</p>
        <div className="space-y-4">
          <label className="block">
            <span className="block text-xs font-bold text-slate-600 mb-1">Payment method</span>
            <select value={method} onChange={e => setMethod(e.target.value as 'CASH' | 'BANK_TRANSFER')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm">
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="CASH">Cash</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-bold text-slate-600 mb-1">Warehouse for staff without one</span>
            <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm">
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-bold text-slate-600 mb-1">Payment date</span>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm" />
          </label>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onCancel} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold text-sm">Cancel</button>
          <button onClick={() => onConfirm(method, warehouseId, date)} disabled={busy || payable.length === 0 || !warehouseId} className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold text-sm disabled:opacity-50">
            {busy ? 'Recording…' : 'Record payment'}
          </button>
        </div>
      </div>
    </div>
  );
}
