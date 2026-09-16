/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Edit2, Plus, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { db } from '../../firebase';
import { collection, getDocs, limit, orderBy, query, startAfter, where } from '../../lib/fs';
import { OperationType, reportFirestoreError } from '../../lib/firestore';
import type { AuditLog } from '../../types';
import { cn } from '../../lib/utils';

const PAGE_SIZE = 50;

interface AuditLogsReportProps {
  companyId: string;
}

function preview(value: unknown): string {
  if (value === undefined || value === null) return '';
  const text = JSON.stringify(value, null, 2);
  return text.length > 4000 ? `${text.slice(0, 4000)}\n…` : text;
}

export default function AuditLogsReport({ companyId }: AuditLogsReportProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [cursor, setCursor] = useState<unknown>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async (after: unknown) => {
    setLoading(true);
    setError(null);
    try {
      const logsRef = collection(db, 'audit_logs');
      const q = after
        ? query(logsRef, where('companyId', '==', companyId), orderBy('timestamp', 'desc'), startAfter(after), limit(PAGE_SIZE))
        : query(logsRef, where('companyId', '==', companyId), orderBy('timestamp', 'desc'), limit(PAGE_SIZE));
      const snap = await getDocs(q);
      const page = snap.docs.map(d => ({ ...(d.data() as AuditLog), id: d.id }));
      setLogs(prev => (after ? [...prev, ...page] : page));
      setCursor(snap.docs.length ? snap.docs[snap.docs.length - 1] : after);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (e) {
      setError(reportFirestoreError(e, OperationType.LIST, 'audit_logs'));
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load(null);
  }, [load]);

  const modules = useMemo(() => Array.from(new Set(logs.map(l => l.module).filter(Boolean))).sort(), [logs]);
  const visible = moduleFilter === 'ALL' ? logs : logs.filter(l => l.module === moduleFilter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 px-2">
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Audit trail</h2>
          <p className="text-[10px] text-slate-400">Newest first · {logs.length} loaded</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value)} className="text-xs font-bold px-3 py-2 bg-white border border-slate-200 rounded-lg" aria-label="Filter by module">
            <option value="ALL">All modules</option>
            {modules.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <button onClick={() => load(null)} disabled={loading} className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 disabled:opacity-50" aria-label="Refresh"><RefreshCw size={14} className={cn(loading && 'animate-spin')} /></button>
        </div>
      </div>

      {error && <p className="bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl p-3" role="alert">{error}</p>}

      {!loading && visible.length === 0 && !error ? (
        <div className="bg-white rounded-2xl p-12 border border-dashed border-slate-300 text-center">
          <ShieldCheck className="mx-auto text-slate-200 mb-4" size={48} />
          <p className="text-slate-400 font-medium">No audit logs found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(log => {
            const open = expanded === log.id;
            const hasData = log.previousData !== undefined || log.newData !== undefined;
            return (
              <div key={log.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex gap-3 min-w-0">
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', log.action === 'CREATE' ? 'bg-emerald-50 text-emerald-600' : log.action === 'UPDATE' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600')}>
                      {log.action === 'CREATE' ? <Plus size={20} /> : log.action === 'UPDATE' ? <Edit2 size={20} /> : <Trash2 size={20} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 leading-tight break-words">{log.details}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded uppercase">{log.module}</span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {log.timestamp ? new Date(log.timestamp).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">{log.userEmail}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={cn('text-[8px] font-black uppercase px-2 py-1 rounded-lg', log.action === 'CREATE' ? 'bg-emerald-100 text-emerald-700' : log.action === 'UPDATE' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700')}>{log.action}</span>
                    {hasData && (
                      <button onClick={() => setExpanded(open ? null : log.id)} className="text-[10px] font-bold text-indigo-600 flex items-center gap-1">
                        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Details
                      </button>
                    )}
                  </div>
                </div>
                {open && (
                  <div className="grid md:grid-cols-2 gap-3 mt-3">
                    {log.previousData !== undefined && (
                      <div><p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Before</p><pre className="text-[10px] bg-slate-50 border border-slate-100 rounded-lg p-2 overflow-auto max-h-64 whitespace-pre-wrap break-words">{preview(log.previousData)}</pre></div>
                    )}
                    {log.newData !== undefined && (
                      <div><p className="text-[9px] font-bold text-slate-400 uppercase mb-1">After</p><pre className="text-[10px] bg-slate-50 border border-slate-100 rounded-lg p-2 overflow-auto max-h-64 whitespace-pre-wrap break-words">{preview(log.newData)}</pre></div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {(hasMore || loading) && (
        <button onClick={() => load(cursor)} disabled={loading} className="w-full py-3 text-xs font-bold text-indigo-600 bg-white border border-slate-200 rounded-xl disabled:opacity-50">
          {loading ? 'Loading…' : 'Load older entries'}
        </button>
      )}
    </div>
  );
}
