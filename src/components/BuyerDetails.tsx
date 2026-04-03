/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  Download, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Calendar, 
  Search,
  Filter,
  FileText,
  Phone,
  MapPin,
  Package,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Buyer, Transaction, JournalEntry } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { db } from '../firebase';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { reportFirestoreError, OperationType } from '../lib/firestore';
import Toast from './Toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface BuyerDetailsProps {
  buyer: Buyer;
  onBack: () => void;
}

export default function BuyerDetails({ buyer, onBack }: BuyerDetailsProps) {
  const { profile, errorMessage, setErrorMessage } = useAuth();
  const [sales, setSales] = useState<Transaction[]>([]);
  const [payments, setPayments] = useState<JournalEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'THIS_MONTH' | 'LAST_MONTH'>('ALL');

  useEffect(() => {
    if (!profile?.companyId || !buyer.id) return;

    // Load Sales
    const qSales = query(
      collection(db, 'transactions'),
      where('companyId', '==', profile.companyId),
      where('type', '==', 'SALE'),
      where('buyerId', '==', buyer.id),
      orderBy('date', 'desc')
    );
    const unsubscribeSales = onSnapshot(qSales, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Transaction));
      setSales(data);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'transactions')));

    // Load Payments (Inflows linked to this buyer)
    const qPayments = query(
      collection(db, 'journal'),
      where('companyId', '==', profile.companyId),
      where('type', '==', 'INFLOW'),
      where('buyerId', '==', buyer.id),
      orderBy('date', 'desc')
    );
    const unsubscribePayments = onSnapshot(qPayments, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as JournalEntry));
      setPayments(data);
    }, (error) => setErrorMessage(reportFirestoreError(error, OperationType.LIST, 'journal')));

    return () => {
      unsubscribeSales();
      unsubscribePayments();
    };
  }, [profile?.companyId, buyer.id]);

  const ledgerEntries = useMemo(() => {
    const entries = [
      ...sales.map(s => ({
        id: s.id,
        date: s.date,
        type: 'SALE' as const,
        description: `${s.commodity} Sale (${(s.netWeight || 0).toFixed(2)}kg @ ₦${(s.pricePerKg || 0).toLocaleString()})`,
        debit: s.totalValue || 0,
        credit: 0,
        reference: s.referenceId
      })),
      ...payments.map(p => ({
        id: p.id,
        date: p.date,
        type: 'PAYMENT' as const,
        description: p.description || 'Cash Payment',
        debit: 0,
        credit: p.amount || 0,
        reference: p.category
      }))
    ];

    return entries.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  }, [sales, payments]);

  const stats = useMemo(() => {
    const totalSales = sales.reduce((sum, s) => sum + (s.totalValue || 0), 0);
    const totalPayments = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const currentBalance = (buyer.previousBalance || 0) + totalSales - totalPayments;

    return { totalSales, totalPayments, currentBalance };
  }, [sales, payments, buyer.previousBalance]);

  const exportPDF = () => {
    const doc = new jsPDF('landscape');
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42);
    doc.text('CUSTOMER LEDGER REPORT', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, pageWidth / 2, 28, { align: 'center' });

    // Buyer Info Box
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.rect(14, 35, pageWidth - 28, 30, 'F');
    
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text((buyer.name || 'UNKNOWN').toUpperCase(), 20, 45);
    
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Phone: ${buyer.phone || 'N/A'}`, 20, 52);
    doc.text(`Location: ${buyer.location || 'N/A'}`, 20, 58);

    // Summary Stats in PDF
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('SUMMARY', pageWidth - 80, 45);
    doc.setFontSize(9);
    doc.text(`Opening Balance: NGN ${(buyer.previousBalance || 0).toLocaleString()}`, pageWidth - 80, 52);
    doc.text(`Total Sales: NGN ${(stats.totalSales || 0).toLocaleString()}`, pageWidth - 80, 58);
    doc.text(`Total Payments: NGN ${(stats.totalPayments || 0).toLocaleString()}`, pageWidth - 80, 64);
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`CURRENT BALANCE: NGN ${(stats.currentBalance || 0).toLocaleString()}`, pageWidth - 80, 72);
    doc.setFont('helvetica', 'normal');

    // Table
    const tableData = ledgerEntries.map((entry, index) => {
      // Calculate running balance for this row
      // Note: ledgerEntries is sorted desc, so we need to calculate from bottom up or use a different approach
      // For simplicity in PDF, let's just show the entries
      return [
        entry.date ? new Date(entry.date).toLocaleDateString() : 'N/A',
        entry.description || '',
        entry.reference || '',
        (entry.debit || 0) > 0 ? `NGN ${(entry.debit || 0).toLocaleString()}` : '-',
        (entry.credit || 0) > 0 ? `NGN ${(entry.credit || 0).toLocaleString()}` : '-',
      ];
    });

    autoTable(doc, {
      startY: 80,
      head: [['Date', 'Description', 'Reference', 'Debit (Sales)', 'Credit (Payments)']],
      body: tableData,
      foot: [
        ['TOTAL', '', '', `NGN ${(stats.totalSales || 0).toLocaleString()}`, `NGN ${(stats.totalPayments || 0).toLocaleString()}`]
      ],
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 9 },
      footStyles: { fillColor: [243, 244, 246], textColor: [31, 41, 55], fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 40 },
        3: { cellWidth: 40, halign: 'right' },
        4: { cellWidth: 40, halign: 'right' },
      }
    });

    doc.save(`${buyer.name.replace(/\s+/g, '_')}_Ledger.pdf`);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <AnimatePresence>
        {errorMessage && (
          <Toast 
            message={errorMessage} 
            type="error" 
            onClose={() => setErrorMessage(null)} 
          />
        )}
      </AnimatePresence>
      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <ArrowLeft size={20} className="text-slate-600" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">{buyer.name}</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Customer Ledger</p>
            </div>
          </div>
          <button 
            onClick={exportPDF}
            className="bg-slate-900 text-white p-2 rounded-xl shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2 text-xs font-bold"
          >
            <Download size={16} /> <span className="hidden sm:inline">Export PDF</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100">
            <p className="text-[8px] font-bold text-blue-600 uppercase mb-1">Total Sales</p>
            <p className="text-sm font-black text-blue-900">₦{(stats.totalSales || 0).toLocaleString()}</p>
          </div>
          <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
            <p className="text-[8px] font-bold text-emerald-600 uppercase mb-1">Payments</p>
            <p className="text-sm font-black text-emerald-900">₦{(stats.totalPayments || 0).toLocaleString()}</p>
          </div>
          <div className={cn(
            "p-3 rounded-2xl border shadow-sm",
            (stats.currentBalance || 0) >= 0 ? "bg-slate-900 border-slate-800 text-white" : "bg-rose-600 border-rose-500 text-white"
          )}>
            <p className="text-[8px] font-bold uppercase mb-1 opacity-70">Balance</p>
            <p className="text-sm font-black">₦{(stats.currentBalance || 0).toLocaleString()}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        {/* Buyer Info Card */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Phone size={14} className="text-slate-400" />
            <span className="font-medium">{buyer.phone || 'N/A'}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <MapPin size={14} className="text-slate-400" />
            <span className="font-medium">{buyer.location || 'N/A'}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Calendar size={14} className="text-slate-400" />
            <span className="font-medium">Joined: {buyer.createdAt ? new Date(buyer.createdAt).toLocaleDateString() : 'N/A'}</span>
          </div>
        </div>

        {/* Ledger List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Transaction History</h2>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400">{ledgerEntries.length} Records</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Opening Balance Row */}
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center text-slate-500">
                  <Wallet size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Opening Balance</p>
                  <p className="text-[10px] text-slate-400">Initial balance at registration</p>
                </div>
              </div>
              <div className="text-right">
                <p className={cn(
                  "text-sm font-black",
                  (buyer.previousBalance || 0) >= 0 ? "text-blue-600" : "text-rose-600"
                )}>
                  {(buyer.previousBalance || 0) >= 0 ? '+' : ''}₦{(buyer.previousBalance || 0).toLocaleString()}
                </p>
              </div>
            </div>

            {ledgerEntries.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="mx-auto text-slate-200 mb-2" size={48} />
                <p className="text-sm text-slate-400 font-medium">No transactions recorded yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {ledgerEntries.map((entry) => (
                  <div key={entry.id} className="p-4 hover:bg-slate-50 transition-colors group">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center",
                          entry.type === 'SALE' ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"
                        )}>
                          {entry.type === 'SALE' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">{entry.description}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">
                              {entry.reference}
                            </span>
                            <span className="text-[10px] text-slate-400">{entry.date ? new Date(entry.date).toLocaleDateString() : 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {(entry.debit || 0) > 0 && (
                          <p className="text-sm font-black text-blue-600">+₦{(entry.debit || 0).toLocaleString()}</p>
                        )}
                        {(entry.credit || 0) > 0 && (
                          <p className="text-sm font-black text-emerald-600">-₦{(entry.credit || 0).toLocaleString()}</p>
                        )}
                        <p className="text-[9px] text-slate-400 uppercase font-bold">
                          {entry.type === 'SALE' ? 'Debit' : 'Credit'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
