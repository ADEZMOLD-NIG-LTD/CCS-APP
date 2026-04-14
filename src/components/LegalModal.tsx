import React from 'react';
import { X, Shield, FileText, Scale } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'privacy' | 'terms';
}

export default function LegalModal({ isOpen, onClose, type }: LegalModalProps) {
  const content = {
    privacy: {
      title: 'Privacy Policy',
      icon: Shield,
      lastUpdated: 'April 12, 2026',
      sections: [
        {
          title: '1. Information We Collect',
          text: 'We collect information you provide directly to us when you create an account, register a company, or use our services. This includes your name, email address, company details, and transaction data related to your commodity trading operations.'
        },
        {
          title: '2. How We Use Your Information',
          text: 'We use the information we collect to provide, maintain, and improve our services, to process your transactions, and to communicate with you about your account and system updates.'
        },
        {
          title: '3. Data Security',
          text: 'We implement enterprise-grade security measures to protect your data. This includes encryption of sensitive information, secure database access controls, and regular security audits. However, no method of transmission over the Internet is 100% secure.'
        },
        {
          title: '4. Data Sharing',
          text: 'We do not sell your personal or business data to third parties. We may share information with service providers who perform services on our behalf, or when required by law.'
        }
      ]
    },
    terms: {
      title: 'Terms of Use',
      icon: Scale,
      lastUpdated: 'April 12, 2026',
      sections: [
        {
          title: '1. Acceptance of Terms',
          text: 'By accessing or using the Commodity Control System (CCS), you agree to be bound by these Terms of Use and all applicable laws and regulations.'
        },
        {
          title: '2. Use License',
          text: 'Permission is granted to use the system for your business operations. This is a license, not a transfer of title, and you may not reverse engineer, decompile, or attempt to extract the source code of the software.'
        },
        {
          title: '3. User Accounts',
          text: 'You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account.'
        },
        {
          title: '4. Disclaimer',
          text: 'The materials on CCS are provided on an "as is" basis. Adezmold Business Consulting makes no warranties, expressed or implied, and hereby disclaims all other warranties including, without limitation, implied warranties of merchantability or fitness for a particular purpose.'
        }
      ]
    }
  };

  const activeContent = content[type];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                  <activeContent.icon size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{activeContent.title}</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Last Updated: {activeContent.lastUpdated}</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              {activeContent.sections.map((section, idx) => (
                <div key={idx} className="space-y-2">
                  <h3 className="font-bold text-slate-900 text-sm uppercase tracking-tight">{section.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {section.text}
                  </p>
                </div>
              ))}

              <div className="pt-8 border-t border-slate-50 text-center">
                <p className="text-xs text-slate-400 italic">
                  If you have any questions regarding these documents, please contact us at <a href="mailto:adezmoldent@gmail.com" className="text-indigo-600 hover:underline font-medium">adezmoldent@gmail.com</a>
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all active:scale-95"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
