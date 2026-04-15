/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShieldCheck, Plus, Edit2, Trash2 } from 'lucide-react';
import { AuditLog } from '../../types';
import { cn } from '../../lib/utils';

interface AuditLogsReportProps {
  auditLogs: AuditLog[];
}

export default function AuditLogsReport({ auditLogs }: AuditLogsReportProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">System Audit Trail</h2>
        <div className="text-[10px] font-bold text-slate-400 uppercase">
          {auditLogs.length} Actions Tracked
        </div>
      </div>

      <div className="space-y-3">
        {auditLogs.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 border border-dashed border-slate-300 text-center">
            <ShieldCheck className="mx-auto text-slate-200 mb-4" size={48} />
            <p className="text-slate-400 font-medium">No audit logs found</p>
          </div>
        ) : (
          auditLogs.map((log) => (
            <div key={log.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-300 transition-colors">
              <div className="flex justify-between items-start">
                <div className="flex gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                    log.action === 'CREATE' ? "bg-emerald-50 text-emerald-600" :
                    log.action === 'UPDATE' ? "bg-amber-50 text-amber-600" :
                    "bg-rose-50 text-rose-600"
                  )}>
                    {log.action === 'CREATE' ? <Plus size={20} /> : 
                     log.action === 'UPDATE' ? <Edit2 size={20} /> : 
                     <Trash2 size={20} />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 leading-tight">{log.details}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                        {log.module}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {new Date(log.timestamp).toLocaleString('en-GB', { 
                          day: '2-digit', 
                          month: 'short', 
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2">
                      <div className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-500">
                        {log.userEmail?.[0].toUpperCase()}
                      </div>
                      <p className="text-[10px] text-slate-500 font-medium">
                        {log.userEmail}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className={cn(
                    "text-[8px] font-black uppercase px-2 py-1 rounded-lg",
                    log.action === 'CREATE' ? "bg-emerald-100 text-emerald-700" :
                    log.action === 'UPDATE' ? "bg-amber-100 text-amber-700" :
                    "bg-rose-100 text-rose-700"
                  )}>
                    {log.action}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
