/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Users, Lock, Clock, XCircle, Briefcase, Phone, Building2, UserMinus, UserCheck, UserX, FileText, Trash2 } from 'lucide-react';
import { Staff, Roster, Warehouse } from '../../types';
import { cn } from '../../lib/utils';

interface RosterManagerProps {
  filteredStaff: Staff[];
  rosters: Roster[];
  warehouses: Warehouse[];
  selectedDate: string;
  canManageStaff: boolean;
  onUpdateRoster: (staffId: string, shift: 'MORNING' | 'AFTERNOON' | 'NIGHT' | 'OFF') => void;
  onUpdateStatus: (staffId: string, status: 'ACTIVE' | 'SUSPENDED' | 'DISMISSED') => void;
  onEdit: (staff: Staff) => void;
  onDelete: (staffId: string) => void;
}

export default function RosterManager({
  filteredStaff,
  rosters,
  warehouses,
  selectedDate,
  canManageStaff,
  onUpdateRoster,
  onUpdateStatus,
  onEdit,
  onDelete
}: RosterManagerProps) {
  return (
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
                          onClick={() => onUpdateRoster(staff.id, shift)}
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
                          onClick={() => onUpdateStatus(staff.id, 'SUSPENDED')}
                          title="Suspend Staff"
                          className="text-slate-300 hover:text-amber-600 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <UserMinus size={14} />
                        </button>
                      ) : staff.status === 'SUSPENDED' ? (
                        <button 
                          onClick={() => onUpdateStatus(staff.id, 'ACTIVE')}
                          title="Recall Staff"
                          className="text-slate-300 hover:text-emerald-600 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <UserCheck size={14} />
                        </button>
                      ) : null}
                      
                      {staff.status !== 'DISMISSED' && (
                        <button 
                          onClick={() => onUpdateStatus(staff.id, 'DISMISSED')}
                          title="Dismiss Staff"
                          className="text-slate-300 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <UserX size={14} />
                        </button>
                      )}

                      <button 
                        onClick={() => onEdit(staff)}
                        title="Edit Staff"
                        className="text-slate-300 hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <FileText size={14} />
                      </button>
                      <button 
                        onClick={() => onDelete(staff.id)}
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
  );
}
