/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Report selectors shared by the on-screen reports and the PDF export, so both always show
 * the same rows and totals.
 */

import jsPDF from 'jspdf';
import autoTable, { type RowInput } from 'jspdf-autotable';
import type { Attendance, BagTransaction, Buyer, Payroll, Staff, Supplier, Transaction, Warehouse } from '../types';
import { moistureLossKg, type CashMovement } from '../lib/finance';
import { isoToLocalDate } from '../lib/dates';
import { formatNumber } from '../lib/utils';
import type { ReportType } from '../components/reports/ReportTabs';

/** jsPDF's built-in fonts cannot render "₦". */
export const pdfMoney = (n: number) => `${n < 0 ? '-' : ''}NGN ${formatNumber(Math.abs(n))}`;

export interface BalanceRow {
  id: string;
  name: string;
  phone?: string;
  location?: string;
  balance: number;
}

export type TransferRow = (Transaction & { transferType: 'COMMODITY' }) | (BagTransaction & { transferType: 'BAG' });

export const TRANSACTION_LABELS: Record<Transaction['type'], string> = {
  PURCHASE: 'Purchase',
  SALE: 'Sale',
  TRANSFER: 'Transfer',
  PURCHASE_RETURN: 'Purchase return',
  SALES_RETURN: 'Sales return',
};

export function searchTransactions(transactions: Transaction[], query: string): Transaction[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return transactions.filter(t => [t.storeRecordId, t.referenceId, t.id].some(v => typeof v === 'string' && v.toLowerCase().includes(q)));
}

export function partyName(t: Transaction, suppliers: Supplier[], buyers: Buyer[]): string {
  if (t.type === 'TRANSFER') return '-';
  if (t.type === 'PURCHASE' || t.type === 'PURCHASE_RETURN') return suppliers.find(s => s.id === t.supplierId)?.name || 'Unknown supplier';
  if (t.buyerId) return buyers.find(b => b.id === t.buyerId)?.name || t.buyerName || 'Unknown customer';
  if (t.supplierId) return `${suppliers.find(s => s.id === t.supplierId)?.name || 'Unknown'} (supplier)`;
  return t.buyerName || 'Unknown customer';
}

export function deductionSummary(t: Transaction): string {
  const d = t.deductions;
  if (!d) return '';
  const parts: string[] = [];
  const moisture = moistureLossKg(d.moistureActual, d.moistureBenchmark, t.grossWeight);
  if (moisture > 0) parts.push(`Moisture ${formatNumber(moisture)}kg`);
  if (d.tareWeight > 0) parts.push(`Tare ${formatNumber(d.tareWeight)}kg`);
  if (d.moldWeight > 0) parts.push(`Mold ${formatNumber(d.moldWeight)}kg`);
  if (d.otherDeduction > 0) parts.push(`Other ${formatNumber(d.otherDeduction)}kg`);
  return parts.join(', ');
}

/** Returns count as negative so totals are net of returns. */
export const signedFor = (t: Transaction) => (t.type === 'PURCHASE_RETURN' || t.type === 'SALES_RETURN' ? -1 : 1);

export interface AttendanceSummaryRow {
  staffId: string;
  name: string;
  role: string;
  present: number;
  late: number;
  absent: number;
  total: number;
}

const dayOf = (value: string) => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : isoToLocalDate(value));

export function attendanceSummary(records: Attendance[], staff: Staff[], filter: { start: string; end: string; warehouseId: string }): AttendanceSummaryRow[] {
  const inRange = records.filter(a => {
    const day = dayOf(a.date || '');
    return !!day && day >= filter.start && day <= filter.end && (filter.warehouseId === 'ALL' || a.warehouseId === filter.warehouseId);
  });
  return staff
    .map(s => {
      const own = inRange.filter(a => a.staffId === s.id);
      return {
        staffId: s.id,
        name: s.name,
        role: s.role,
        present: own.filter(a => a.status === 'PRESENT').length,
        late: own.filter(a => a.status === 'LATE').length,
        absent: own.filter(a => a.status === 'ABSENT').length,
        total: own.length,
        include: own.length > 0 || (!s.isDeleted && (filter.warehouseId === 'ALL' || s.assignedWarehouseId === filter.warehouseId)),
      };
    })
    .filter(r => r.include)
    .map(({ include: _include, ...row }) => row)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function payrollInPeriod(payrolls: Payroll[], start: string, end: string): Payroll[] {
  const from = start.slice(0, 7);
  const to = end.slice(0, 7);
  return payrolls.filter(p => p.month >= from && p.month <= to).sort((a, b) => b.month.localeCompare(a.month) || a.staffId.localeCompare(b.staffId));
}

export interface ReportPdfInput {
  report: ReportType;
  companyName: string;
  startDate: string;
  endDate: string;
  warehouseLabel: string;
  commodityLabel: string;
  warehouses: Warehouse[];
  suppliers: Supplier[];
  buyers: Buyer[];
  staff: Staff[];
  supplierBalances: BalanceRow[];
  buyerBalances: BalanceRow[];
  bagLevels: Record<string, number>;
  bagTransactions: BagTransaction[];
  operational: Transaction[];
  transfers: TransferRow[];
  movements: CashMovement[];
  searchQuery: string;
  searchResults: Transaction[];
  attendance: AttendanceSummaryRow[];
  payrolls: Payroll[];
}

type Doc = jsPDF & { lastAutoTable?: { finalY: number } };

export function generatePDF(input: ReportPdfInput): void {
  const landscape = !['supplier_balances', 'buyer_balances', 'packaging_inventory', 'attendance'].includes(input.report);
  const doc = new jsPDF(landscape ? 'l' : 'p') as Doc;
  const pageWidth = doc.internal.pageSize.getWidth();
  const warehouseName = (id?: string) => input.warehouses.find(w => w.id === id)?.name || '-';
  const baseStyles = { theme: 'grid' as const, headStyles: { fillColor: [79, 70, 229] as [number, number, number] }, footStyles: { fillColor: [243, 244, 246] as [number, number, number], textColor: [31, 41, 55] as [number, number, number], fontStyle: 'bold' as const }, styles: { fontSize: 8.5 } };

  const header = (title: string, subtitle: string) => {
    doc.setFontSize(20);
    doc.setTextColor(16, 185, 129);
    doc.text((input.companyName || 'Commodity Control System').toUpperCase(), pageWidth / 2, 18, { align: 'center' });
    doc.setDrawColor(200);
    doc.line(14, 24, pageWidth - 14, 24);
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(title, 14, 33);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(subtitle, 14, 39);
    doc.text(`Generated ${new Date().toLocaleString()}`, 14, 44);
    doc.setTextColor(0);
    return 50;
  };

  const next = (gap = 12) => (doc.lastAutoTable ? doc.lastAutoTable.finalY + gap : 50);

  const balanceSection = (label: string, rows: BalanceRow[], total: number, color: [number, number, number], y: number) => {
    doc.setFontSize(11);
    doc.setTextColor(...color);
    doc.text(label, 14, y);
    doc.setTextColor(0);
    autoTable(doc, {
      ...baseStyles,
      startY: y + 4,
      head: [['Name', 'Phone', 'Location', 'Balance']],
      body: rows.length ? rows.map(r => [r.name, r.phone || '-', r.location || '-', pdfMoney(Math.abs(r.balance))]) : [['No balances', '', '', '']],
      foot: [['TOTAL', '', '', pdfMoney(total)]],
      headStyles: { fillColor: color },
      columnStyles: { 3: { halign: 'right' } },
    });
  };

  const period = `Period: ${input.startDate} to ${input.endDate} | Warehouse: ${input.warehouseLabel}`;
  const asAt = `As at ${input.endDate} | Warehouse: ${input.warehouseLabel}`;

  switch (input.report) {
    case 'supplier_balances':
    case 'buyer_balances': {
      const isSupplier = input.report === 'supplier_balances';
      const rows = isSupplier ? input.supplierBalances : input.buyerBalances;
      // Supplier: positive = we owe. Buyer: positive = they owe us.
      const weOwe = rows.filter(r => (isSupplier ? r.balance > 0 : r.balance < 0));
      const theyOwe = rows.filter(r => (isSupplier ? r.balance < 0 : r.balance > 0));
      const sum = (list: BalanceRow[]) => list.reduce((s, r) => s + Math.abs(r.balance), 0);
      const y = header(isSupplier ? 'Supplier balances' : 'Customer balances', asAt);
      balanceSection('WE OWE (accounts payable)', weOwe, sum(weOwe), [79, 70, 229], y);
      balanceSection('THEY OWE US (accounts receivable)', theyOwe, sum(theyOwe), [225, 29, 72], next(14));
      break;
    }
    case 'packaging_inventory': {
      const y = header('Packaging inventory', asAt);
      autoTable(doc, {
        ...baseStyles,
        startY: y,
        head: [['Bag type', 'Balance (units)']],
        body: ['JUTE_BAG', 'NYLON_BAG'].map(type => [type.replace('_', ' '), formatNumber(input.bagLevels[type] || 0, 0)]),
        columnStyles: { 1: { halign: 'right' } },
      });
      autoTable(doc, {
        ...baseStyles,
        startY: next(),
        head: [['Date', 'Type', 'Bag', 'Warehouse / route', 'Reference', 'Quantity']],
        body: input.bagTransactions.map(b => [
          new Date(b.date).toLocaleDateString(),
          b.type.replace('_', ' '),
          b.packagingType.replace('_', ' '),
          b.type === 'TRANSFER' ? `${warehouseName(b.sourceWarehouseId)} -> ${warehouseName(b.destinationWarehouseId)}` : warehouseName(b.warehouseId),
          b.reference || '-',
          formatNumber(b.quantity, 0),
        ]),
        columnStyles: { 5: { halign: 'right' } },
      });
      break;
    }
    case 'transfers': {
      const y = header('Stock transfers', `${period} | Commodity: ${input.commodityLabel}`);
      autoTable(doc, {
        ...baseStyles,
        startY: y,
        head: [['Date', 'Type', 'Item', 'From', 'To', 'Quantity', 'Reference']],
        body: input.transfers.map(t => [
          new Date(t.date).toLocaleDateString(),
          t.transferType,
          t.transferType === 'COMMODITY' ? t.commodity : t.packagingType.replace('_', ' '),
          warehouseName(t.sourceWarehouseId),
          warehouseName(t.destinationWarehouseId),
          t.transferType === 'COMMODITY' ? `${formatNumber(t.netWeight)}kg` : `${formatNumber(t.quantity, 0)} units`,
          t.transferType === 'COMMODITY' ? t.referenceId : t.reference,
        ]),
        columnStyles: { 5: { halign: 'right' } },
      });
      break;
    }
    case 'journal': {
      const y = header('Cash book', period);
      const inflow = input.movements.filter(m => m.direction === 'IN').reduce((s, m) => s + m.amount, 0);
      const outflow = input.movements.filter(m => m.direction === 'OUT').reduce((s, m) => s + m.amount, 0);
      autoTable(doc, {
        ...baseStyles,
        startY: y,
        head: [['Date', 'Channel', 'Category', 'Warehouse', 'Description', 'In', 'Out']],
        body: input.movements.map(m => [
          new Date(m.date).toLocaleDateString(),
          m.channel,
          m.category.replace(/_/g, ' '),
          warehouseName(m.warehouseId),
          m.description,
          m.direction === 'IN' ? pdfMoney(m.amount) : '-',
          m.direction === 'OUT' ? pdfMoney(m.amount) : '-',
        ]),
        foot: [['TOTAL', '', '', '', `Net ${pdfMoney(inflow - outflow)}`, pdfMoney(inflow), pdfMoney(outflow)]],
        columnStyles: { 4: { cellWidth: 80 }, 5: { halign: 'right' }, 6: { halign: 'right' } },
      });
      break;
    }
    case 'search': {
      const y = header(`Transaction search: "${input.searchQuery}"`, `${input.searchResults.length} result(s)`);
      autoTable(doc, {
        ...baseStyles,
        startY: y,
        head: [['Date', 'Type', 'Tranx ID', 'Reference', 'Party', 'Commodity', 'Net weight', 'Value']],
        body: input.searchResults.map(t => [
          new Date(t.date).toLocaleDateString(),
          TRANSACTION_LABELS[t.type],
          t.storeRecordId || '-',
          t.referenceId,
          partyName(t, input.suppliers, input.buyers),
          t.commodity,
          `${formatNumber(t.netWeight)}kg`,
          t.type === 'TRANSFER' ? '-' : pdfMoney(t.totalValue || 0),
        ]),
        columnStyles: { 6: { halign: 'right' }, 7: { halign: 'right' } },
      });
      break;
    }
    case 'attendance': {
      const y = header('Attendance', period);
      autoTable(doc, {
        ...baseStyles,
        startY: y,
        head: [['Staff', 'Role', 'Days recorded', 'Present', 'Late', 'Absent']],
        body: input.attendance.map(r => [r.name, r.role, r.total, r.present, r.late, r.absent]) as RowInput[],
      });
      break;
    }
    case 'payroll': {
      const y = header('Payroll', `Months ${input.startDate.slice(0, 7)} to ${input.endDate.slice(0, 7)}`);
      const total = (key: 'grossIncome' | 'pension' | 'paye' | 'otherDeductions' | 'netPay') => pdfMoney(input.payrolls.reduce((s, p) => s + (p[key] || 0), 0));
      autoTable(doc, {
        ...baseStyles,
        startY: y,
        head: [['Month', 'Staff', 'Status', 'Gross', 'Pension', 'PAYE', 'Other deductions', 'Net pay']],
        body: input.payrolls.map(p => [
          p.month,
          input.staff.find(s => s.id === p.staffId)?.name || 'Unknown',
          p.status,
          pdfMoney(p.grossIncome),
          pdfMoney(p.pension),
          pdfMoney(p.paye),
          pdfMoney(p.otherDeductions || 0),
          pdfMoney(p.netPay),
        ]),
        foot: [['TOTAL', '', '', total('grossIncome'), total('pension'), total('paye'), total('otherDeductions'), total('netPay')]],
        columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' } },
      });
      break;
    }
    case 'operational_purchases':
    case 'operational_sales': {
      const purchases = input.report === 'operational_purchases';
      const y = header(purchases ? 'Purchases (net of returns)' : 'Sales (net of returns)', `${period} | Commodity: ${input.commodityLabel}`);
      const rows = input.operational;
      const net = (fn: (t: Transaction) => number) => rows.reduce((s, t) => s + signedFor(t) * fn(t), 0);
      autoTable(doc, {
        ...baseStyles,
        startY: y,
        head: [['Date', 'Type', 'Ref', 'Party', 'Commodity', 'Warehouse', 'Bags', 'Gross', 'Deductions', 'Net', 'Price/kg', 'Value']],
        body: rows.map(t => {
          const sign = signedFor(t) < 0 ? '-' : '';
          const deductions = deductionSummary(t);
          return [
            new Date(t.date).toLocaleDateString(),
            TRANSACTION_LABELS[t.type] + (t.isDirectDelivery ? ' (direct)' : ''),
            t.referenceId,
            partyName(t, input.suppliers, input.buyers),
            t.commodity + (t.calculationMethod === 'MANUAL' ? ' (manual)' : ''),
            t.isDirectDelivery ? 'Direct delivery' : warehouseName(t.warehouseId),
            formatNumber(t.noOfBags || t.bags || 0, 0),
            `${formatNumber(t.grossWeight)}kg`,
            `${formatNumber(Math.max(0, t.grossWeight - t.netWeight))}kg${deductions ? `\n(${deductions})` : ''}`,
            `${sign}${formatNumber(t.netWeight)}kg`,
            t.pricePerKg ? pdfMoney(t.pricePerKg) : '-',
            `${sign}${pdfMoney(t.totalValue || 0)}`,
          ];
        }),
        foot: [['TOTAL', '', '', '', '', '', formatNumber(net(t => t.noOfBags || t.bags || 0), 0), `${formatNumber(net(t => t.grossWeight))}kg`, '', `${formatNumber(net(t => t.netWeight))}kg`, '', pdfMoney(net(t => t.totalValue || 0))]],
        styles: { fontSize: 7.5, cellPadding: 1.5 },
        columnStyles: { 6: { halign: 'center' }, 7: { halign: 'right' }, 8: { halign: 'right' }, 9: { halign: 'right' }, 10: { halign: 'right' }, 11: { halign: 'right' } },
      });
      break;
    }
    default:
      return;
  }

  doc.save(`${input.report}_${input.startDate}_${input.endDate}.pdf`);
}
