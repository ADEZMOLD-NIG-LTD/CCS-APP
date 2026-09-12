import fs from 'fs';

let content = fs.readFileSync('src/components/BroadcastModule.tsx', 'utf8');
content = content.replace(
  "import { Megaphone, Send, AlertCircle, CheckCircle } from 'lucide-react';",
  "import { Megaphone, Send, AlertCircle, CheckCircle, Info } from 'lucide-react';"
);
content = content.replace(/profile\.id/g, "profile.uid");
fs.writeFileSync('src/components/BroadcastModule.tsx', content);

let content2 = fs.readFileSync('src/components/NotificationsBell.tsx', 'utf8');
content2 = content2.replace(/profile\.id/g, "profile.uid");
content2 = content2.replace(/profile\?.id/g, "profile?.uid");
fs.writeFileSync('src/components/NotificationsBell.tsx', content2);
