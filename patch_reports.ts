import fs from 'fs';

let content = fs.readFileSync('src/components/ReportsModule.tsx', 'utf8');

// Add to imports
content = content.replace(
  'import { Supplier, Transaction, Payment, JournalEntry, Warehouse, Buyer, BagTransaction, AuditLog } from \'../types\';',
  'import { Supplier, Transaction, Payment, JournalEntry, Warehouse, Buyer, BagTransaction, AuditLog, Staff, Attendance, Payroll } from \'../types\';'
);

content = content.replace(
  'import JournalReport from \'./reports/JournalReport\';',
  'import JournalReport from \'./reports/JournalReport\';\nimport AttendanceReport from \'./reports/AttendanceReport\';\nimport PayrollReport from \'./reports/PayrollReport\';'
);

// Add to states
content = content.replace(
  'const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);',
  'const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);\n  const [staffList, setStaffList] = useState<Staff[]>([]);\n  const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([]);\n  const [payrollRecords, setPayrollRecords] = useState<Payroll[]>([]);'
);

// Add to fetch
const fetchLogic = `
    const qStaff = query(collection(db, 'staff'), where('companyId', '==', profile.companyId));
    const unsubscribeStaff = onSnapshot(qStaff, (snapshot) => {
      setStaffList(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Staff)));
    });

    const qAttendance = query(collection(db, 'attendance'), where('companyId', '==', profile.companyId));
    const unsubscribeAttendance = onSnapshot(qAttendance, (snapshot) => {
      setAttendanceRecords(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Attendance)));
    });

    const qPayroll = query(collection(db, 'payrolls'), where('companyId', '==', profile.companyId));
    const unsubscribePayroll = onSnapshot(qPayroll, (snapshot) => {
      setPayrollRecords(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Payroll)));
    });
`;

content = content.replace(
  'const unsubscribeAudit = onSnapshot(qAudit, (snapshot) => {',
  fetchLogic + '\n    const unsubscribeAudit = onSnapshot(qAudit, (snapshot) => {'
);

content = content.replace(
  'unsubscribeAudit();',
  'unsubscribeAudit();\n      unsubscribeStaff();\n      unsubscribeAttendance();\n      unsubscribePayroll();'
);

// Add to render
const renderBlocks = `
          ) : activeReport === 'attendance' ? (
            <AttendanceReport
              key="attendance-report"
              attendanceRecords={attendanceRecords}
              staffList={staffList}
              warehouses={warehouses}
              startDate={startDate}
              endDate={endDate}
              selectedWarehouseId={selectedWarehouseId}
            />
          ) : activeReport === 'payroll' ? (
            <PayrollReport
              key="payroll-report"
              payrollRecords={payrollRecords}
              staffList={staffList}
              startDate={startDate}
              endDate={endDate}
            />
`;

content = content.replace(
  ') : activeReport === \'journal\' ? (',
  renderBlocks + '\n          ) : activeReport === \'journal\' ? ('
);

fs.writeFileSync('src/components/ReportsModule.tsx', content);
