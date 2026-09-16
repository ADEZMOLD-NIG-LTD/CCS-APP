/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { AttendanceSummaryRow } from '../../services/reportService';

interface AttendanceReportProps {
  rows: AttendanceSummaryRow[];
  startDate: string;
  endDate: string;
}

export default function AttendanceReport({ rows, startDate, endDate }: AttendanceReportProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 bg-slate-50 border-b border-slate-200">
        <h3 className="font-bold text-slate-900">Attendance</h3>
        <p className="text-xs text-slate-500">{startDate} to {endDate}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100/50 border-b border-slate-200">
              {['Staff', 'Role', 'Days recorded', 'Present', 'Late', 'Absent'].map(h => (
                <th key={h} className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400 text-sm">No attendance records found for this period.</td></tr>
            ) : rows.map(row => (
              <tr key={row.staffId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3 font-bold text-slate-900 text-sm">{row.name}</td>
                <td className="px-4 py-3 text-xs font-medium text-slate-600">{row.role}</td>
                <td className="px-4 py-3 text-xs font-bold text-slate-900">{row.total}</td>
                <td className="px-4 py-3 text-xs font-bold text-emerald-600">{row.present}</td>
                <td className="px-4 py-3 text-xs font-bold text-amber-600">{row.late}</td>
                <td className="px-4 py-3 text-xs font-bold text-rose-600">{row.absent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
