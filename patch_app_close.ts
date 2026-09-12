import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  '<div className="w-9 h-9 bg-slate-100 text-[var(--text-secondary)] rounded-xl flex items-center justify-center font-bold text-xs border border-[var(--border)] group-hover:bg-blue-50 group-hover:text-[var(--accent)] group-hover:border-blue-100 transition-all">\n            {profile?.displayName?.charAt(0)}\n          </div>\n        </div>',
  '<div className="w-9 h-9 bg-slate-100 text-[var(--text-secondary)] rounded-xl flex items-center justify-center font-bold text-xs border border-[var(--border)] group-hover:bg-blue-50 group-hover:text-[var(--accent)] group-hover:border-blue-100 transition-all">\n            {profile?.displayName?.charAt(0)}\n          </div>\n        </div>\n        </div>'
);

fs.writeFileSync('src/App.tsx', content);
