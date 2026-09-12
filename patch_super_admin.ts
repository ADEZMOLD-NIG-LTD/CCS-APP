import fs from 'fs';

let content = fs.readFileSync('src/components/SuperAdminModule.tsx', 'utf8');

content = content.replace(
  "import { Company, UserProfile } from '../types';",
  "import { Company, UserProfile } from '../types';\nimport BroadcastModule from './BroadcastModule';"
);

content = content.replace(
  "const [activeTab, setActiveTab] = useState<'companies' | 'users' | 'health' | 'infrastructure'>('companies');",
  "const [activeTab, setActiveTab] = useState<'companies' | 'users' | 'health' | 'infrastructure' | 'broadcast'>('companies');"
);

content = content.replace(
  "<Server size={14} /> System\n          </button>",
  "<Server size={14} /> System\n          </button>\n          <button\n            onClick={() => setActiveTab('broadcast')}\n            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${\n              activeTab === 'broadcast' ? 'bg-white text-[var(--accent)] shadow-sm' : 'text-[var(--text-secondary)]'\n            }`}\n          >\n            <Megaphone size={14} /> Broadcast\n          </button>"
);

content = content.replace(
  "import { Building2, CheckCircle2, XCircle, Search, Clock, Activity, Users, ShieldAlert, ShieldCheck, Database, Server, AlertTriangle, Trash2, UserMinus, Mail, UserPlus, RefreshCw, Plus, Pencil, Layers, Shield, Lock, SlidersHorizontal } from 'lucide-react';",
  "import { Building2, CheckCircle2, XCircle, Search, Clock, Activity, Users, ShieldAlert, ShieldCheck, Database, Server, AlertTriangle, Trash2, UserMinus, Mail, UserPlus, RefreshCw, Plus, Pencil, Layers, Shield, Lock, SlidersHorizontal, Megaphone } from 'lucide-react';"
);

content = content.replace(
  "{activeTab === 'infrastructure' && (",
  "{activeTab === 'broadcast' && (\n            <motion.div \n              key=\"broadcast\"\n              initial={{ opacity: 0, x: 20 }}\n              animate={{ opacity: 1, x: 0 }}\n              exit={{ opacity: 0, x: -20 }}\n            >\n              <BroadcastModule />\n            </motion.div>\n          )}\n\n          {activeTab === 'infrastructure' && ("
);

fs.writeFileSync('src/components/SuperAdminModule.tsx', content);
