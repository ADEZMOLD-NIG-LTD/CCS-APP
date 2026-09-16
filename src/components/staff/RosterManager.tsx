/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Briefcase, Building2, Clock, FileText, KeyRound, Lock, Mail, Phone, Send, Trash2, UserCheck, UserMinus, UserX, Users, XCircle } from 'lucide-react';
import type { Invite, Roster, Staff, UserProfile, Warehouse } from '../../types';
import { ROLE_LABELS, type CompanyRole } from '../../lib/permissions';
import { cn, formatCurrency, normalizeEmail } from '../../lib/utils';

interface RosterManagerProps {
  staff: Staff[];
  rosters: Roster[];
  warehouses: Warehouse[];
  selectedDate: string;
  actorRole: CompanyRole | null;
  currentUid: string;
  canManageStaff: boolean;
  canManageRoster: boolean;
  invitesByEmail: Record<string, Invite>;
  usersById: Record<string, UserProfile>;
  onUpdateRoster: (staff: Staff, shift: Roster['shift']) => void;
  onUpdateStatus: (staff: Staff, status: Staff['status']) => void;
  onInvite: (staff: Staff) => void;
  onSendPasswordEmail: (staff: Staff) => void;
  onForcePasswordChange: (staff: Staff) => void;
  onEdit: (staff: Staff) => void;
  onDelete: (staff: Staff) => void;
}

function IconButton({ title, onClick, className, children }: { title: string; onClick: () => void; className: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} title={title} aria-label={title} className={cn('text-slate-400 transition-colors p-1', className)}>
      {children}
    </button>
  );
}

export default function RosterManager({
  staff, rosters, warehouses, selectedDate, actorRole, currentUid, canManageStaff, canManageRoster,
  invitesByEmail, usersById, onUpdateRoster, onUpdateStatus, onInvite, onSendPasswordEmail, onForcePasswordChange, onEdit, onDelete,
}: RosterManagerProps) {
  if (staff.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-12 border border-dashed border-slate-300 text-center">
        <Users className="mx-auto text-slate-200 mb-2" size={48} />
        <p className="text-sm text-slate-400">No staff members found for this warehouse</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {staff.map(member => {
        const roster = rosters.find(r => r.staffId === member.id && r.date === selectedDate);
        const email = normalizeEmail(member.email);
        const pendingInvite = email ? invitesByEmail[email] : undefined;
        const account = member.uid ? usersById[member.uid] : undefined;
        const isSelf = member.uid === currentUid;
        const protectedAdmin = member.role === 'ADMIN' && actorRole !== 'ADMIN';
        const canAct = canManageStaff && !isSelf && !protectedAdmin;

        return (
          <div key={member.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-start gap-3">
              <div className="flex gap-3 min-w-0">
                <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg shrink-0">
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 flex flex-wrap items-center gap-2">
                    {member.name}
                    {member.uid ? (
                      <span className={cn('text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase flex items-center gap-0.5', account?.status && account.status !== 'ACTIVE' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600')}>
                        <Lock size={8} /> {account?.status && account.status !== 'ACTIVE' ? `Login ${account.status.toLowerCase()}` : 'Login active'}
                      </span>
                    ) : pendingInvite ? (
                      <span className="bg-amber-50 text-amber-600 text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase">Invite pending</span>
                    ) : null}
                    {member.status !== 'ACTIVE' && (
                      <span className={cn('text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase flex items-center gap-0.5', member.status === 'SUSPENDED' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600')}>
                        {member.status === 'SUSPENDED' ? <Clock size={8} /> : <XCircle size={8} />} {member.status}
                      </span>
                    )}
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                    <span className="flex items-center gap-1 text-[10px] text-slate-500 font-medium"><Briefcase size={10} /> {ROLE_LABELS[member.role] ?? member.role}</span>
                    <span className="flex items-center gap-1 text-[10px] text-slate-500 font-medium"><Phone size={10} /> {member.phone}</span>
                    {member.assignedWarehouseId && (
                      <span className="flex items-center gap-1 text-[10px] text-indigo-500 font-bold">
                        <Building2 size={10} /> {warehouses.find(w => w.id === member.assignedWarehouseId)?.name || 'Store'}
                      </span>
                    )}
                  </div>
                  {canManageRoster && member.status === 'ACTIVE' && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(['MORNING', 'AFTERNOON', 'NIGHT', 'OFF'] as const).map(shift => (
                        <button
                          key={shift}
                          type="button"
                          onClick={() => onUpdateRoster(member, shift)}
                          className={cn('px-2 py-1 rounded text-[8px] font-black uppercase', roster?.shift === shift ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-400 hover:bg-slate-100')}
                        >
                          {shift}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-black text-slate-900">{formatCurrency((member.salary || 0) + (member.allowances || 0))}</p>
                <p className="text-[9px] text-slate-400 uppercase">Monthly gross</p>
                {canAct && (
                  <div className="flex items-center justify-end gap-1 mt-2">
                    {member.status === 'ACTIVE' ? (
                      <IconButton title="Suspend" onClick={() => onUpdateStatus(member, 'SUSPENDED')} className="hover:text-amber-600"><UserMinus size={14} /></IconButton>
                    ) : (
                      <IconButton title="Reinstate" onClick={() => onUpdateStatus(member, 'ACTIVE')} className="hover:text-emerald-600"><UserCheck size={14} /></IconButton>
                    )}
                    {email && !member.uid && (
                      <IconButton title={pendingInvite ? 'Resend invitation' : 'Invite to log in'} onClick={() => onInvite(member)} className="hover:text-indigo-600"><Send size={14} /></IconButton>
                    )}
                    {email && (
                      <IconButton title="Send password email" onClick={() => onSendPasswordEmail(member)} className="hover:text-indigo-600"><Mail size={14} /></IconButton>
                    )}
                    {member.uid && account && (
                      <IconButton title="Require a new password at next sign-in" onClick={() => onForcePasswordChange(member)} className="hover:text-amber-600"><KeyRound size={14} /></IconButton>
                    )}
                    {member.status !== 'DISMISSED' && (
                      <IconButton title="Dismiss" onClick={() => onUpdateStatus(member, 'DISMISSED')} className="hover:text-rose-600"><UserX size={14} /></IconButton>
                    )}
                    <IconButton title="Edit" onClick={() => onEdit(member)} className="hover:text-indigo-600"><FileText size={14} /></IconButton>
                    <IconButton title="Remove" onClick={() => onDelete(member)} className="hover:text-rose-600"><Trash2 size={14} /></IconButton>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
