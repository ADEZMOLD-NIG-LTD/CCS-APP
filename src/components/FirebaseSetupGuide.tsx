/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Package, ShieldAlert, Cpu, ExternalLink, Copy, Check } from 'lucide-react';
import { useState } from 'react';

export default function FirebaseSetupGuide() {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const domains = [
    window.location.hostname,
    "commodityclick.com.ng"
  ];

  const envVars = [
    "VITE_FIREBASE_API_KEY",
    "VITE_FIREBASE_AUTH_DOMAIN",
    "VITE_FIREBASE_PROJECT_ID",
    "VITE_FIREBASE_STORAGE_BUCKET",
    "VITE_FIREBASE_MESSAGING_SENDER_ID",
    "VITE_FIREBASE_APP_ID"
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden">
        <div className="p-8 lg:p-12">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center border border-amber-500/30">
              <ShieldAlert className="text-amber-500" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">System Configuration Error</h1>
              <p className="text-slate-400 text-sm">Firebase credentials are missing or incomplete.</p>
            </div>
          </div>

          <div className="space-y-6 text-slate-300">
            <section className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700/50">
              <h2 className="text-amber-400 text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                <Cpu size={14} /> Step 1: Environment Variables
              </h2>
              <p className="text-sm mb-4 leading-relaxed">
                To fix this permanently, copy your Firebase configuration values into the <b>Secrets</b> panel (Settings &gt; Secrets) in AI Studio using these exact keys:
              </p>
              <div className="grid grid-cols-1 gap-2">
                {envVars.map(v => (
                  <div key={v} className="bg-slate-950 px-4 py-2 rounded-xl flex items-center justify-between border border-slate-800 group">
                    <code className="text-[10px] text-blue-400 font-bold tracking-wider">{v}</code>
                    <button 
                      onClick={() => copyToClipboard(v, v)}
                      className="text-slate-500 hover:text-white transition-colors"
                    >
                      {copied === v ? <Check size={14} className="text-emerald-500" /> : <Copy size={12} />}
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700/50">
              <h2 className="text-blue-400 text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                <ExternalLink size={14} /> Step 2: Authorized Domains
              </h2>
              <p className="text-sm mb-4 leading-relaxed">
                If Auth works in dev but fails in production, ensure these domains are added to <b>Firebase Console &gt; Authentication &gt; Settings &gt; Authorized Domains</b>:
              </p>
              <div className="space-y-2">
                {domains.map(d => (
                  <div key={d} className="bg-slate-950 px-4 py-2 rounded-xl flex items-center justify-between border border-slate-800">
                    <code className="text-xs text-slate-400">{d}</code>
                    <button 
                      onClick={() => copyToClipboard(d, d)}
                      className="text-slate-500 hover:text-white transition-colors"
                    >
                      {copied === d ? <Check size={14} className="text-emerald-500" /> : <Copy size={12} />}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="mt-12 flex flex-col sm:flex-row gap-4">
            <button 
              onClick={() => window.location.reload()}
              className="flex-1 bg-white text-slate-950 px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-wider hover:bg-slate-100 transition-all active:scale-95 shadow-xl shadow-white/5"
            >
              Check Configuration
            </button>
            <a 
              href="https://console.firebase.google.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex-1 bg-slate-800 text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-wider hover:bg-slate-700 transition-all active:scale-95 text-center border border-slate-700"
            >
              Open Firebase Console
            </a>
          </div>
          
          <div className="mt-8 text-center">
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">
              Note: You can also run the "Firebase Setup" tool in the agent chat if available.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
