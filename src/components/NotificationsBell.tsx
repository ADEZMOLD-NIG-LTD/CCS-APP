import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Info, AlertCircle, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { collection, limit, onSnapshot, orderBy, query, where } from '../lib/fs';
import { commitWrites, type WriteOp } from '../lib/writes';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../lib/logger';
import { GLOBAL_NOTIFICATION_COMPANY_ID, type SystemNotification } from '../types';

const PAGE_SIZE = 20;

export default function NotificationsBell() {
  const { user, profile, accessState } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [companyItems, setCompanyItems] = useState<SystemNotification[]>([]);
  const [globalItems, setGlobalItems] = useState<SystemNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);

  const uid = user?.uid;
  const companyId = accessState === 'READY' ? profile?.companyId : undefined;

  useEffect(() => {
    if (!uid) return;
    const unsubscribers: Array<() => void> = [];
    const toItems = (docs: { id: string; data: () => unknown }[]) => docs.map(d => ({ ...(d.data() as SystemNotification), id: d.id }));

    unsubscribers.push(onSnapshot(
      query(collection(db, 'notifications'), where('companyId', '==', GLOBAL_NOTIFICATION_COMPANY_ID), orderBy('createdAt', 'desc'), limit(PAGE_SIZE)),
      snapshot => setGlobalItems(toItems(snapshot.docs)),
      error => logger.warn('Global notifications unavailable', error)
    ));

    if (companyId) {
      unsubscribers.push(onSnapshot(
        query(collection(db, 'notifications'), where('companyId', '==', companyId), orderBy('createdAt', 'desc'), limit(PAGE_SIZE)),
        snapshot => setCompanyItems(toItems(snapshot.docs)),
        error => logger.warn('Company notifications unavailable', error)
      ));
    } else {
      setCompanyItems([]);
    }

    unsubscribers.push(onSnapshot(
      collection(db, 'users', uid, 'notification_reads'),
      snapshot => setReadIds(new Set(snapshot.docs.map(d => d.id))),
      error => logger.warn('Notification read state unavailable', error)
    ));

    return () => unsubscribers.forEach(fn => fn());
  }, [uid, companyId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const notifications = useMemo(() => {
    const role = profile?.role;
    return [...companyItems, ...globalItems]
      .filter(n => !n.targetRole || n.targetRole === 'ALL' || n.targetRole === role)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, PAGE_SIZE);
  }, [companyItems, globalItems, profile?.role]);

  const unread = notifications.filter(n => !readIds.has(n.id));

  const markRead = (ids: string[]) => {
    if (!uid || ids.length === 0) return;
    const readAt = new Date().toISOString();
    const ops: WriteOp[] = ids.map(id => ({ kind: 'set', collection: `users/${uid}/notification_reads`, id, data: { readAt } }));
    commitWrites(ops).catch(error => logger.warn('Could not mark notifications read', error));
  };

  const icon = (type: string) => {
    if (type === 'update') return <CheckCircle size={16} className="text-emerald-500" />;
    if (type === 'alert') return <AlertCircle size={16} className="text-rose-500" />;
    return <Info size={16} className="text-blue-500" />;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(v => !v)}
        className="relative p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
        aria-label={`Notifications${unread.length ? ` (${unread.length} unread)` : ''}`}
      >
        <Bell size={20} />
        {unread.length > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white" />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[100]"
          >
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Notifications</h3>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Announcements</p>
              </div>
              {unread.length > 0 && (
                <button onClick={() => markRead(unread.map(n => n.id))} className="text-[10px] text-indigo-600 font-bold hover:underline">
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <Bell size={32} className="mx-auto mb-2 opacity-20" />
                  <p className="text-xs">No announcements yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {notifications.map(n => {
                    const isRead = readIds.has(n.id);
                    return (
                      <button
                        key={n.id}
                        onClick={() => !isRead && markRead([n.id])}
                        className={`w-full text-left p-4 hover:bg-slate-50 transition-colors flex gap-3 ${isRead ? 'opacity-60' : 'bg-blue-50/30'}`}
                      >
                        <div className="mt-0.5 shrink-0">{icon(n.type)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1">
                            <h4 className="text-sm font-bold text-slate-900">{n.title}</h4>
                            <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap ml-2">
                              {new Date(n.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line break-words">{n.message}</p>
                          <p className="text-[9px] text-slate-400 mt-2 font-medium">
                            From: {n.creatorName}{n.companyId === GLOBAL_NOTIFICATION_COMPANY_ID ? ' · Platform' : ''}
                          </p>
                        </div>
                        {!isRead && <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0 mt-1.5" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
