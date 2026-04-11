/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  BookOpen, 
  ChevronRight, 
  LayoutDashboard, 
  Users, 
  Package, 
  ShoppingCart, 
  TrendingUp, 
  Receipt, 
  Building2, 
  BarChart3, 
  FileText, 
  Shield, 
  WifiOff,
  CheckCircle2,
  Info,
  HelpCircle,
  PlayCircle,
  Clock,
  UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

interface GuideSection {
  id: string;
  title: string;
  icon: any;
  roles: string[];
  content: {
    title: string;
    steps: string[];
    tips?: string[];
  }[];
}

const TRAINING_DATA: GuideSection[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: BookOpen,
    roles: ['ADMIN', 'MANAGER', 'ACCOUNT', 'STORE_KEEPER', 'AUDITOR', 'STAFF'],
    content: [
      {
        title: 'First Login',
        steps: [
          'Log in with your provided email and default password.',
          'You will be prompted to change your password immediately.',
          'Choose a strong password that you can remember.',
          'Once changed, you will be redirected to the main dashboard.'
        ],
        tips: ['Keep your password secret. Never share your login details with anyone.']
      },
      {
        title: 'Understanding the Dashboard',
        steps: [
          'The Home screen gives you a quick overview of your business.',
          'Admins see total stock, sales, and cash flow.',
          'Staff see their current shift and attendance status.',
          'Use the menu button (top left) to navigate between modules.'
        ]
      }
    ]
  },
  {
    id: 'inventory',
    title: 'Inventory & Purchases',
    icon: Package,
    roles: ['ADMIN', 'MANAGER', 'STORE_KEEPER'],
    content: [
      {
        title: 'Recording a Purchase',
        steps: [
          'Go to the "Stock" or "Buy" module.',
          'Select the Supplier and Commodity type.',
          'Enter the Gross Weight and Bag Count.',
          'The system automatically calculates Net Weight based on deductions.',
          'Save the record. It will update the warehouse stock immediately.'
        ],
        tips: ['Double-check moisture content as it affects the final price and weight deductions.']
      },
      {
        title: 'Stock Transfers',
        steps: [
          'Use the "Transfer" feature to move stock between warehouses.',
          'Select the Source Warehouse and Destination Warehouse.',
          'Enter the quantity to move.',
          'Both warehouses will have their stock levels updated automatically.'
        ]
      }
    ]
  },
  {
    id: 'sales',
    title: 'Sales & Buyers',
    icon: TrendingUp,
    roles: ['ADMIN', 'MANAGER', 'ACCOUNT'],
    content: [
      {
        title: 'Making a Sale',
        steps: [
          'Go to the "Sales" module.',
          'Select the Buyer and the Warehouse stock is being taken from.',
          'Enter the quantity and price per unit.',
          'The system calculates the total amount.',
          'Save the sale to update inventory and financial records.'
        ]
      },
      {
        title: 'Managing Buyers',
        steps: [
          'Add new buyers in the "Buyers" module.',
          'Track buyer balances and transaction history.',
          'Generate invoices for completed sales.'
        ]
      }
    ]
  },
  {
    id: 'finance',
    title: 'Finance & Payments',
    icon: Receipt,
    roles: ['ADMIN', 'ACCOUNT'],
    content: [
      {
        title: 'Supplier Payments',
        steps: [
          'Go to the "Suppliers" module and select a supplier.',
          'Click "Add Payment" to record a cash or bank transfer.',
          'The payment will be deducted from the supplier\'s outstanding balance.',
          'You can view the full payment history for each supplier.'
        ]
      },
      {
        title: 'Journal Entries',
        steps: [
          'Use the "Journal" module for non-purchase/sale expenses (e.g., fuel, repairs).',
          'Categorize expenses to keep track of where money is going.',
          'Admins can review all journal entries for auditing.'
        ]
      }
    ]
  },
  {
    id: 'staff',
    title: 'Staff & Payroll',
    icon: Users,
    roles: ['ADMIN', 'ACCOUNT'],
    content: [
      {
        title: 'Attendance Tracking',
        steps: [
          'Managers or Admins mark daily attendance in the "Staff" module.',
          'Select the date and mark staff as Present, Absent, or Late.',
          'Attendance records directly influence payroll calculations.'
        ]
      },
      {
        title: 'Generating Payroll',
        steps: [
          'At the end of the month, go to the Payroll tab in the Staff module.',
          'Click "Generate Payroll" for the current month.',
          'The system calculates Basic Salary, Allowances, Pension, and PAYE Tax.',
          'Export the payroll to CSV for bank processing.'
        ]
      }
    ]
  },
  {
    id: 'store-keeper',
    title: 'Store Operations',
    icon: Building2,
    roles: ['ADMIN', 'STORE_KEEPER', 'MANAGER'],
    content: [
      {
        title: 'Daily Store Records',
        steps: [
          'Store Keepers use the "Store Records" module to log physical movements.',
          'Record every bag that enters or leaves the warehouse.',
          'Log transfers between internal store sections.',
          'This provides a physical audit trail to compare against digital inventory.'
        ]
      }
    ]
  },
  {
    id: 'offline',
    title: 'Working Offline',
    icon: WifiOff,
    roles: ['ADMIN', 'MANAGER', 'ACCOUNT', 'STORE_KEEPER', 'AUDITOR', 'STAFF'],
    content: [
      {
        title: 'Offline Continuity',
        steps: [
          'The system is designed to work even without internet.',
          'You can still save suppliers, purchases, and sales while offline.',
          'The app will show a "Success" message immediately (Optimistic Update).',
          'Data is saved to your device and will sync to the cloud when you reconnect.'
        ],
        tips: [
          'Do not clear your browser cache while you have unsynced data.',
          'Look for the "Offline" indicator at the top of the screen.'
        ]
      }
    ]
  }
];

export default function TrainingModule() {
  const { profile } = useAuth();
  const [activeSection, setActiveSection] = useState<string>('getting-started');

  const userRole = profile?.role || 'STAFF';
  
  const filteredSections = TRAINING_DATA.filter(section => 
    section.roles.includes(userRole) || userRole === 'ADMIN'
  );

  const currentSection = TRAINING_DATA.find(s => s.id === activeSection) || TRAINING_DATA[0];

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      <header className="bg-white border-b border-slate-200 px-6 py-6 shrink-0">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
            <BookOpen size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Training Guide</h1>
            <p className="text-xs text-slate-500 font-medium">Learn how to use the CCS System effectively</p>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Navigation */}
        <aside className="w-64 bg-white border-r border-slate-200 overflow-y-auto hidden md:block">
          <nav className="p-4 space-y-1">
            <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Modules</p>
            {filteredSections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-left",
                  activeSection === section.id 
                    ? "bg-indigo-50 text-indigo-600 shadow-sm" 
                    : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <section.icon size={18} className={activeSection === section.id ? "text-indigo-600" : "text-slate-400"} />
                <span className="text-sm font-bold">{section.title}</span>
                {activeSection === section.id && <ChevronRight size={14} className="ml-auto" />}
              </button>
            ))}
          </nav>

          <div className="mt-8 p-6">
            <div className="bg-indigo-900 rounded-2xl p-4 text-white shadow-xl">
              <HelpCircle size={24} className="mb-2 text-indigo-300" />
              <h4 className="text-sm font-bold mb-1">Need Help?</h4>
              <p className="text-[10px] text-indigo-200 leading-relaxed">Contact your system administrator for technical support or account issues.</p>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-6 md:p-10 bg-white">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-indigo-600 border border-slate-100">
                <currentSection.icon size={32} />
              </div>
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">{currentSection.title}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <Shield size={12} className="text-slate-400" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Target Roles: {currentSection.roles.join(', ')}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-12">
              {currentSection.content.map((block, idx) => (
                <motion.section 
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="relative"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-md">
                      {idx + 1}
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">{block.title}</h3>
                  </div>

                  <div className="ml-4 pl-8 border-l-2 border-slate-100 space-y-6">
                    <ul className="space-y-4">
                      {block.steps.map((step, sIdx) => (
                        <li key={sIdx} className="flex items-start gap-3 group">
                          <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 group-hover:scale-150 transition-transform" />
                          <p className="text-slate-600 leading-relaxed font-medium">{step}</p>
                        </li>
                      ))}
                    </ul>

                    {block.tips && block.tips.length > 0 && (
                      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 flex gap-4">
                        <Info className="text-amber-500 shrink-0" size={20} />
                        <div>
                          <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Pro Tip</p>
                          {block.tips.map((tip, tIdx) => (
                            <p key={tIdx} className="text-sm text-amber-900 font-medium leading-relaxed">{tip}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.section>
              ))}
            </div>

            {/* Role Specific Guidance */}
            <div className="mt-20 pt-10 border-t border-slate-100">
              <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/20 rounded-full -mr-32 -mt-32 blur-3xl" />
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <UserCheck className="text-indigo-400" size={24} />
                    <h4 className="text-lg font-bold">Role-Based Summary</h4>
                  </div>
                  <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                    As a <span className="text-white font-bold">{userRole}</span>, your primary focus should be on the modules listed in your sidebar. 
                    Ensure you complete your daily tasks and check for any pending syncs if you've been working offline.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                      <p className="text-[10px] font-bold text-indigo-400 uppercase mb-2">Daily Checklist</p>
                      <ul className="text-xs space-y-2 text-slate-300">
                        <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-400" /> Verify login status</li>
                        <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-400" /> Check for offline sync</li>
                        <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-400" /> Complete assigned tasks</li>
                      </ul>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                      <p className="text-[10px] font-bold text-indigo-400 uppercase mb-2">Security Reminder</p>
                      <ul className="text-xs space-y-2 text-slate-300">
                        <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-400" /> Change password regularly</li>
                        <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-400" /> Log out after session</li>
                        <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-400" /> Report suspicious activity</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden bg-white border-t border-slate-200 p-2 flex overflow-x-auto no-scrollbar gap-2">
        {filteredSections.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all",
              activeSection === section.id 
                ? "bg-indigo-600 text-white shadow-md" 
                : "bg-slate-50 text-slate-500"
            )}
          >
            <section.icon size={14} />
            <span className="text-xs font-bold">{section.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
