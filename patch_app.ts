import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Import NotificationsBell
content = content.replace(
  "import { Menu, LogOut, Package, Users, ShoppingCart, BarChart3, Settings, Shield, Store, Building2, BookOpen, AlertCircle, LayoutDashboard, Wallet, WifiOff } from 'lucide-react';",
  "import { Menu, LogOut, Package, Users, ShoppingCart, BarChart3, Settings, Shield, Store, Building2, BookOpen, AlertCircle, LayoutDashboard, Wallet, WifiOff } from 'lucide-react';\nimport NotificationsBell from './components/NotificationsBell';"
);

// Add the bell before the user profile in the header
const headerTarget = `<div \n          onClick={() => { setActiveModule('settings'); setShowMenu(false); }}\n          className="flex items-center gap-3 pl-3 border-l border-[var(--border)] cursor-pointer group"\n        >`;

const headerReplacement = `<div className="flex items-center gap-2">\n          <NotificationsBell />\n          <div \n            onClick={() => { setActiveModule('settings'); setShowMenu(false); }}\n            className="flex items-center gap-3 pl-3 border-l border-[var(--border)] cursor-pointer group"\n          >`;

content = content.replace(headerTarget, headerReplacement);
// Need to add closing </div> after the User profile section. 
// Wait, replacing `onClick={() => { setActiveModule('settings'); setShowMenu(false); }}`... 
// It's better to just add it before the `<div onClick={() => setActiveModule('settings')...`
