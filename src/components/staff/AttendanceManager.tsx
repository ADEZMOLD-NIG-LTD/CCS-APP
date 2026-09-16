/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Users, CheckCircle2, Clock, XCircle } from 'lucide-react';
import type { Staff, Attendance, Roster } from '../../types';
import { ROLE_LABELS } from '../../lib/permissions';
import { cn } from '../../lib/utils';

interface AttendanceManagerProps {
  staff: Staff[];
  attendance: Attendance[];
  rosters: Roster[];
  selectedDate: string;
  canMark: boolean;
  onMarkAttendance: (staff: Staff, status: 'PRESENT' | 'ABSENT' | 'LATE') => void;
}

const OPTIONS = [
  { status: 'PRESENT' as const, icon: CheckCircle2, active: 'bg-emerald-100 text-emerald-600', label: 'Present' },
  { status: 'LATE' as const, icon: Clock, active: 'bg-amber-100 text-amber-600', label: 'Late' },
  { status: 'ABSENT' as const, icon: XCircle, active: 'bg-rose-100 text-rose-600', label: 'Absent' },
];

export default function AttendanceManager({ staff, attendance, rosters, selectedDate, canMark, onMarkAttendance }: AttendanceManagerProps) {
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
        const record = attendance.find(a => a.staffId === member.id && a.date === selectedDate);
        const roster = rosters.find(r => r.staffId === member.id && r.date === selectedDate);
        return (
          <div key={member.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">{member.name}</h3>
              <div className="flex items-center gap-2">
                <p className="text-[10px] text-slate-400 uppercase tracking-tighter">{ROLE_LABELS[member.role] ?? member.role}</p>
                {roster && <span className="text-[8px] bg-indigo-50 text-indigo-600 px-1 rounded font-black uppercase">{roster.shift}</span>}
              </div>
            </div>
            <div className="flex gap-2">
              {member.status === 'ACTIVE' ? (
                OPTIONS.map(option => (
                  <button
                    key={option.status}
                    type="button"
                    disabled={!canMark}
                    onClick={() => onMarkAttendance(member, option.status)}
                    title={option.label}
                    aria-label={`${option.label}: ${member.name}`}
                    aria-pressed={record?.status === option.status}
                    className={cn('p-2 rounded-lg transition-all disabled:cursor-not-allowed', record?.status === option.status ? option.active : 'bg-slate-50 text-slate-300')}
                  >
                    <option.icon size={20} />
                  </button>
                ))
              ) : (
                <span className={cn('text-[10px] px-3 py-2 rounded-xl font-black uppercase', member.status === 'SUSPENDED' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600')}>
                  {member.status}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
