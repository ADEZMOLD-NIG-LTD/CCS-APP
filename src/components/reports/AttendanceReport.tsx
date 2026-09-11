/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Staff, Attendance, Warehouse } from '../../types';
import { Users, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface AttendanceReportProps {
  attendanceRecords: Attendance[];
  staffList: Staff[];
  warehouses: Warehouse[];
  startDate: string;
  endDate: string;
  selectedWarehouseId: string;
}

export default function AttendanceReport({
  attendanceRecords,
  staffList,
  warehouses,
  startDate,
  endDate,
  selectedWarehouseId
}: AttendanceReportProps) {
  // Filter attendance records by date and warehouse
  const filteredAttendance = attendanceRecords.filter(a => {
    const dateMatch = a.date >= startDate && a.date <= endDate;
    const warehouseMatch = selectedWarehouseId === 'ALL' || a.warehouseId === selectedWarehouseId;
    return dateMatch && warehouseMatch;
  });

  // Calculate stats per staff
  const staffStats = staffList.map(staff => {
    const staffRecords = filteredAttendance.filter(a => a.staffId === staff.id);
    const present = staffRecords.filter(a => a.status === 'PRESENT').length;
    const late = staffRecords.filter(a => a.status === 'LATE').length;
    const absent = staffRecords.filter(a => a.status === 'ABSENT').length;
    const total = staffRecords.length;

    return {
      ...staff,
      present,
      late,
      absent,
      total
    };
  }).filter(s => s.total > 0 || selectedWarehouseId === 'ALL' || s.assignedWarehouseId === selectedWarehouseId); // show staff with records, or all if matched warehouse

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 bg-slate-50 border-b border-slate-200">
        <h3 className="font-bold text-slate-900">Attendance Report</h3>
        <p className="text-xs text-slate-500">{startDate} to {endDate}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100/50 border-b border-slate-200">
              <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">Staff</th>
              <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">Role</th>
              <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">Total Days</th>
              <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">Present</th>
              <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">Late</th>
              <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">Absent</th>
            </tr>
          </thead>
          <tbody>
            {staffStats.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-400 text-sm">
                  No attendance records found for this period.
                </td>
              </tr>
            ) : (
              staffStats.map(staff => (
                <tr key={staff.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-900 text-sm">{staff.name}</p>
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-slate-600">{staff.role}</td>
                  <td className="px-4 py-3 text-xs font-bold text-slate-900">{staff.total}</td>
                  <td className="px-4 py-3 text-xs font-bold text-emerald-600">{staff.present}</td>
                  <td className="px-4 py-3 text-xs font-bold text-amber-600">{staff.late}</td>
                  <td className="px-4 py-3 text-xs font-bold text-rose-600">{staff.absent}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
