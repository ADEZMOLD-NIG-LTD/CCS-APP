/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ShieldAlert, Cpu, ExternalLink, Copy, Check } from 'lucide-react';

const ENV_VARS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_FIREBASE_FIRESTORE_DATABASE_ID',
];

export default function FirebaseSetupGuide() {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => undefined);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-2xl p-8 lg:p-12">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center border border-amber-500/30">
            <ShieldAlert className="text-amber-500" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Configuration required</h1>
            <p className="text-slate-400 text-sm">Firebase settings are missing from this build.</p>
          </div>
        </div>

        <section className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700/50 text-slate-300 mb-6">
          <h2 className="text-amber-400 text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2">
            <Cpu size={14} /> Build-time environment variables
          </h2>
          <p className="text-sm mb-4 leading-relaxed">Set these in your CI secrets (or a local <code>.env</code>) and rebuild. See DEPLOYMENT.md.</p>
          <div className="grid grid-cols-1 gap-2">
            {ENV_VARS.map(v => (
              <div key={v} className="bg-slate-950 px-4 py-2 rounded-xl flex items-center justify-between border border-slate-800">
                <code className="text-[10px] text-blue-400 font-bold tracking-wider">{v}</code>
                <button onClick={() => copy(v)} className="text-slate-500 hover:text-white" aria-label={`Copy ${v}`}>
                  {copied === v ? <Check size={14} className="text-emerald-500" /> : <Copy size={12} />}
                </button>
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-col sm:flex-row gap-4">
          <button onClick={() => window.location.reload()} className="flex-1 bg-white text-slate-950 px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-wider">
            Reload
          </button>
          <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="flex-1 bg-slate-800 text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-wider text-center border border-slate-700 flex items-center justify-center gap-2">
            Firebase console <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}
