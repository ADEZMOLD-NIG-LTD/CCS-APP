import React, { useState, useEffect, useRef } from 'react';
import { Bell, Info, AlertCircle, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { collection, onSnapshot, query, where, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { SystemNotification } from '../types';

export default function NotificationsBell() {
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profile?.companyId) return;

    const q = query(
      collection(db, 'notifications'),
      where('companyId', '==', profile.companyId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as SystemNotification));
      // Filter by role if targetRole is set
      const relevant = data.filter(n => !n.targetRole || n.targetRole === 'ALL' || n.targetRole === profile.role);
      // Sort by createdAt desc
      const sorted = relevant.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(sorted);
    });

    return () => unsubscribe();
  }, [profile?.companyId, profile?.role]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.readBy?.includes(profile?.uid || '')).length;

  const markAllAsRead = async () => {
    if (!profile?.uid) return;
    const unread = notifications.filter(n => !n.readBy?.includes(profile.uid));
    for (const notification of unread) {
      try {
        await updateDoc(doc(db, 'notifications', notification.id), {
          readBy: arrayUnion(profile.uid)
        });
      } catch (error) {
        console.error("Error marking all as read:", error);
      }
    }
  };

  const markAsRead = async (id: string) => {
    if (!profile?.uid) return;
    const notification = notifications.find(n => n.id === id);
    if (notification && !notification.readBy?.includes(profile.uid)) {
      try {
        await updateDoc(doc(db, 'notifications', id), {
          readBy: arrayUnion(profile.uid)
        });
      } catch (error) {
        console.error("Error marking as read:", error);
      }
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'update': return <CheckCircle size={16} className="text-emerald-500" />;
      case 'alert': return <AlertCircle size={16} className="text-rose-500" />;
      default: return <Info size={16} className="text-blue-500" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white animate-pulse"></span>
        )}
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
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">System Announcements</p>
              </div>
              {unreadCount > 0 && (
                <button 
                  onClick={markAllAsRead}
                  className="text-[10px] text-indigo-600 font-bold hover:underline"
                >
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
                  {notifications.map(notification => {
                    const isRead = notification.readBy?.includes(profile?.uid || '');
                    return (
                      <div 
                        key={notification.id} 
                        onClick={() => markAsRead(notification.id)}
                        className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer flex gap-3 ${isRead ? 'opacity-60' : 'bg-blue-50/30'}`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {getIcon(notification.type)}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-1">
                            <h4 className="text-sm font-bold text-slate-900">{notification.title}</h4>
                            <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap ml-2">
                              {new Date(notification.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{notification.message}</p>
                          <p className="text-[9px] text-slate-400 mt-2 font-medium">From: {notification.creatorName}</p>
                        </div>
                        {!isRead && (
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0 mt-1.5" />
                        )}
                      </div>
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
