import fs from 'fs';

let content = fs.readFileSync('src/mockFirebase.ts', 'utf8');
content = content.replace(
  "export const serverTimestamp = () => new Date().toISOString();",
  "export const serverTimestamp = () => new Date().toISOString();\nexport const arrayUnion = (...elements: any[]) => elements;"
);

fs.writeFileSync('src/mockFirebase.ts', content);
