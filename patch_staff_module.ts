import fs from 'fs';

let content = fs.readFileSync('src/components/StaffModule.tsx', 'utf8');

// Add state for editing deductions
const editDeductionState = `
  const [editingDeduction, setEditingDeduction] = useState<Payroll | null>(null);
  const [deductionAmount, setDeductionAmount] = useState('');
  const [deductionNote, setDeductionNote] = useState('');
`;

content = content.replace(
  'const [viewingPayroll, setViewingPayroll] = useState<Payroll | null>(null);',
  'const [viewingPayroll, setViewingPayroll] = useState<Payroll | null>(null);\n' + editDeductionState
);

// Add saveDeduction function
const saveDeductionFunc = `
  const handleSaveDeduction = async () => {
    if (!editingDeduction) return;
    setSubmitting(true);
    try {
      const amount = Number(deductionAmount) || 0;
      const netPay = editingDeduction.grossIncome - editingDeduction.pension - editingDeduction.paye - amount;
      
      await setDoc(doc(db, 'payrolls', editingDeduction.id), {
        otherDeductions: amount,
        deductionsNote: deductionNote,
        netPay: netPay
      }, { merge: true });
      
      setSuccessMessage('Deductions updated successfully');
      setEditingDeduction(null);
    } catch (error) {
      setErrorMessage('Failed to update deductions');
    } finally {
      setSubmitting(false);
    }
  };
`;

content = content.replace(
  'const generatePayroll = async () => {',
  saveDeductionFunc + '\n  const generatePayroll = async () => {'
);

// Update exportPayrollCSV
content = content.replace(
  '\'PAYE\', \'Net Pay\',',
  '\'PAYE\', \'Other Deductions\', \'Deductions Note\', \'Net Pay\','
);

content = content.replace(
  'p.paye,\n        p.netPay,',
  'p.paye,\n        p.otherDeductions || 0,\n        p.deductionsNote || \'\',\n        p.netPay,'
);

// Update PayrollManager props
content = content.replace(
  'onViewPayslip={setViewingPayroll}',
  'onViewPayslip={setViewingPayroll}\n              onEditDeductions={(p) => {\n                setEditingDeduction(p);\n                setDeductionAmount(String(p.otherDeductions || \'\'));\n                setDeductionNote(p.deductionsNote || \'\');\n              }}'
);

// Add deduction modal
const deductionModal = `
      {/* Deductions Modal */}
      <AnimatePresence>
        {editingDeduction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl p-6"
            >
              <h3 className="text-lg font-bold text-slate-900 mb-4">Edit Deductions</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Deduction Amount (₦)</label>
                  <input
                    type="number"
                    value={deductionAmount}
                    onChange={(e) => setDeductionAmount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm"
                    placeholder="e.g. 50000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Deduction Note / Reason</label>
                  <input
                    type="text"
                    value={deductionNote}
                    onChange={(e) => setDeductionNote(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm"
                    placeholder="e.g. Salary Advance for August"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setEditingDeduction(null)}
                  className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveDeduction}
                  disabled={submitting}
                  className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm shadow-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Deductions'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
`;

content = content.replace(
  '<PayslipModal',
  deductionModal + '\n      <PayslipModal'
);

fs.writeFileSync('src/components/StaffModule.tsx', content);
