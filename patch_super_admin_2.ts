import fs from 'fs';

let content = fs.readFileSync('src/components/SuperAdminModule.tsx', 'utf8');

content = content.replace(
  "{activeTab !== 'health' && (",
  "{activeTab !== 'health' && activeTab !== 'broadcast' && ("
);

content = content.replace(
  "{activeTab !== 'health' && (\n          <div className=\"text-center py-6\">\n            <p className=\"text-slate-400 font-medium text-xs\">\n              Showing {activeTab === 'companies' ? filteredCompanies.length : filteredUsers.length} results",
  "{activeTab !== 'health' && activeTab !== 'broadcast' && activeTab !== 'infrastructure' && (\n          <div className=\"text-center py-6\">\n            <p className=\"text-slate-400 font-medium text-xs\">\n              Showing {activeTab === 'companies' ? filteredCompanies.length : filteredUsers.length} results"
);

fs.writeFileSync('src/components/SuperAdminModule.tsx', content);
