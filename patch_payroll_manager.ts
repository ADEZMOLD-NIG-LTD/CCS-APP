import fs from 'fs';

let content = fs.readFileSync('src/components/staff/PayrollManager.tsx', 'utf8');

// Add onUpdateDeductions to props
content = content.replace(
  'onViewPayslip: (payroll: Payroll) => void;',
  'onViewPayslip: (payroll: Payroll) => void;\n  onEditDeductions: (payroll: Payroll) => void;'
);

content = content.replace(
  'onViewPayslip\n}: PayrollManagerProps)',
  'onViewPayslip,\n  onEditDeductions\n}: PayrollManagerProps)'
);

// Add Deductions column to table
content = content.replace(
  '<th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">PAYE</th>',
  '<th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">PAYE</th>\n                <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">Deductions</th>'
);

content = content.replace(
  '<td colSpan={6}',
  '<td colSpan={7}'
);

content = content.replace(
  '<td className="px-4 py-4 text-xs font-medium text-rose-500">-{formatCurrency(p.paye)}</td>',
  '<td className="px-4 py-4 text-xs font-medium text-rose-500">-{formatCurrency(p.paye)}</td>\n                      <td className="px-4 py-4 text-xs font-medium text-rose-500 cursor-pointer hover:bg-slate-100 rounded-lg transition-colors" onClick={() => onEditDeductions(p)} title={p.deductionsNote || "Click to add deductions (Loans, Advance, etc.)"}>\n                        {p.otherDeductions ? `-${formatCurrency(p.otherDeductions)}` : <span className="text-slate-300">Add...</span>}\n                        {p.deductionsNote && <p className="text-[9px] text-slate-400 truncate max-w-[100px]">{p.deductionsNote}</p>}\n                      </td>'
);

fs.writeFileSync('src/components/staff/PayrollManager.tsx', content);
