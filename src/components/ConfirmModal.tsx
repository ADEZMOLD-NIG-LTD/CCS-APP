/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  requireReason?: boolean;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger',
  requireReason = false
}: ConfirmModalProps) {
  const [reason, setReason] = React.useState('');
  const [error, setError] = React.useState(false);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (requireReason && !reason.trim()) {
      setError(true);
      return;
    }
    onConfirm(reason);
    setReason('');
    setError(false);
    onCancel();
  };

  const accentColor = {
    danger: 'bg-rose-600 hover:bg-rose-700 text-white',
    warning: 'bg-amber-600 hover:bg-amber-700 text-white',
    info: 'bg-indigo-600 hover:bg-indigo-700 text-white'
  }[type];

  const iconBg = {
    danger: 'bg-rose-100 text-rose-600',
    warning: 'bg-amber-100 text-amber-600',
    info: 'bg-indigo-100 text-indigo-600'
  }[type];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <motion.div
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           exit={{ opacity: 0 }}
           onClick={onCancel}
           className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />
        <motion.div
           initial={{ opacity: 0, scale: 0.95, y: 20 }}
           animate={{ opacity: 1, scale: 1, y: 0 }}
           exit={{ opacity: 0, scale: 0.95, y: 20 }}
           className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
        >
           <div className="p-6">
             <div className="flex items-center justify-between mb-6">
               <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${iconBg}`}>
                 <AlertCircle size={24} />
               </div>
               <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors">
                 <X size={20} />
               </button>
             </div>
             
             <h3 className="text-xl font-black text-slate-900 mb-2">{title}</h3>
             <p className="text-slate-500 text-sm leading-relaxed mb-6">
               {message}
             </p>

             {requireReason && (
               <div className="mb-6">
                 <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 ml-1">
                   Reason for deletion <span className="text-rose-500">*</span>
                 </label>
                 <textarea
                   value={reason}
                   onChange={(e) => {
                     setReason(e.target.value);
                     setError(false);
                   }}
                   placeholder="e.g., Typo in weight, Duplicate entry..."
                   className={`w-full bg-slate-50 border ${error ? 'border-rose-300' : 'border-slate-200'} rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-rose-500 min-h-[100px] resize-none transition-all`}
                 />
                 {error && <p className="text-rose-500 text-[10px] font-bold mt-1 ml-1">Please provide a reason</p>}
               </div>
             )}

             <div className="flex flex-col gap-3">
               <button
                 onClick={handleConfirm}
                 className={`w-full py-4 rounded-2xl font-bold shadow-lg active:scale-[0.98] transition-all ${accentColor}`}
               >
                 {confirmText}
               </button>
               <button
                 onClick={onCancel}
                 className="w-full py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition-all"
               >
                 {cancelText}
               </button>
             </div>
           </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
