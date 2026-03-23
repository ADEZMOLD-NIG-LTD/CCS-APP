import React, { useState, useEffect } from 'react';
import { Building2, CheckCircle2, XCircle, Search, Clock } from 'lucide-react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Company } from '../types';
import { useAuth } from '../contexts/AuthContext';

export default function SuperAdminModule() {
  const { approveCompany } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'companies'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Company));
      setCompanies(data);
    });
    return () => unsubscribe();
  }, []);

  const filteredCompanies = companies.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.ownerEmail.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
        <h1 className="text-xl font-bold text-slate-900">Super Admin Console</h1>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Manage Company Registrations</p>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Search companies or owners..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
          />
        </div>

        <div className="space-y-3">
          {filteredCompanies.map(company => (
            <div key={company.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start">
                <div className="flex gap-3">
                  <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center">
                    <Building2 size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{company.name}</h3>
                    <p className="text-xs text-slate-500">{company.ownerEmail}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Registered: {new Date(company.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                
                {company.isApproved ? (
                  <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full text-[10px] font-bold uppercase">
                    <CheckCircle2 size={12} /> Approved
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-amber-600 bg-amber-50 px-3 py-1 rounded-full text-[10px] font-bold uppercase">
                    <Clock size={12} /> Pending
                  </div>
                )}
              </div>

              {!company.isApproved && (
                <div className="mt-4 pt-4 border-t border-slate-50">
                  <button 
                    onClick={() => approveCompany(company.id)}
                    className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={18} /> Approve Registration
                  </button>
                </div>
              )}
            </div>
          ))}

          {filteredCompanies.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-100 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
                <Building2 size={32} />
              </div>
              <p className="text-slate-400 font-medium">No companies found</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
