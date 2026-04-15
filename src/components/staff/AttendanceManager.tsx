/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Users, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Staff, Attendance, Roster } from '../../types';
import { cn } from '../../lib/utils';

interface AttendanceManagerProps {
  filteredStaff: Staff[];
  attendance: Attendance[];
  rosters: Roster[];
  selectedDate: string;
  onMarkAttendance: (staffId: string, status: 'PRESENT' | 'ABSENT' | 'LATE') => void;
}

export default function AttendanceManager({
  filteredStaff,
  attendance,
  rosters,
  selectedDate,
  onMarkAttendance
}: AttendanceManagerProps) {
  return (
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
                        onClick={() => onMarkAttendance(staff.id, 'PRESENT')}
                        className={cn(
                          "p-2 rounded-lg transition-all",
                          record?.status === 'PRESENT' ? "bg-emerald-100 text-emerald-600" : "bg-slate-50 text-slate-300"
                        )}
                      >
                        <CheckCircle2 size={20} />
                      </button>
                      <button 
                        onClick={() => onMarkAttendance(staff.id, 'LATE')}
                        className={cn(
                          "p-2 rounded-lg transition-all",
                          record?.status === 'LATE' ? "bg-amber-100 text-amber-600" : "bg-slate-50 text-slate-300"
                        )}
                      >
                        <Clock size={20} />
                      </button>
                      <button 
                        onClick={() => onMarkAttendance(staff.id, 'ABSENT')}
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
  );
}
