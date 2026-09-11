import fs from 'fs';

let content = fs.readFileSync('src/components/staff/PayslipModal.tsx', 'utf8');

// Add "Other Deductions" below PAYE Tax if it exists
content = content.replace(
  '<span className="font-bold text-rose-500">-{formatCurrency(viewingPayroll.paye)}</span>\n            </div>',
  '<span className="font-bold text-rose-500">-{formatCurrency(viewingPayroll.paye)}</span>\n            </div>\n            {!!viewingPayroll.otherDeductions && (\n              <div className="flex justify-between text-sm">\n                <span className="text-slate-500">Other Deductions {viewingPayroll.deductionsNote && <span className="text-[10px] text-slate-400">({viewingPayroll.deductionsNote})</span>}</span>\n                <span className="font-bold text-rose-500">-{formatCurrency(viewingPayroll.otherDeductions)}</span>\n              </div>\n            )}'
);

fs.writeFileSync('src/components/staff/PayslipModal.tsx', content);
