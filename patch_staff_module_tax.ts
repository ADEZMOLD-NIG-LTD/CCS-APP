import fs from 'fs';

let content = fs.readFileSync('src/components/StaffModule.tsx', 'utf8');

// handleSaveStaff update
content = content.replace(
  'accountName: formData.get(\'accountName\') as string,\n      ...(email ? { email } : {}),',
  'accountName: formData.get(\'accountName\') as string,\n      applyPAYE: formData.get(\'applyPAYE\') === \'on\',\n      applyPension: formData.get(\'applyPension\') === \'on\',\n      ...(email ? { email } : {}),'
);

content = content.replace(
  'accountName: formData.get(\'accountName\') as string,\n      ...(email ? { email } : { email: undefined }),',
  'accountName: formData.get(\'accountName\') as string,\n      applyPAYE: formData.get(\'applyPAYE\') === \'on\',\n      applyPension: formData.get(\'applyPension\') === \'on\',\n      ...(email ? { email } : { email: undefined }),'
);

// generatePayroll update
content = content.replace(
  'const pension = gross * 0.08;',
  'const pension = staff.applyPension !== false ? gross * 0.08 : 0;'
);

content = content.replace(
  'const paye = calculatePAYE(gross, pension);',
  'const paye = staff.applyPAYE !== false ? calculatePAYE(gross, pension) : 0;'
);

fs.writeFileSync('src/components/StaffModule.tsx', content);
