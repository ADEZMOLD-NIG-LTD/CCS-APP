import fs from 'fs';

let content = fs.readFileSync('src/mockFirebase.ts', 'utf8');

if (!content.includes('export const arrayUnion')) {
  content += "\nexport const arrayUnion = (...elements: any[]) => elements;";
  fs.writeFileSync('src/mockFirebase.ts', content);
}
