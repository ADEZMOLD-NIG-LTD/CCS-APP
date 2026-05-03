/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Supplier, 
  Transaction, 
  Warehouse, 
  Buyer, 
  BagTransaction, 
  Company,
  JournalEntry 
} from '../types';
import { formatNumber, formatCurrency, getWeightInKg } from '../lib/utils';

interface PDFData {
  activeReport: string;
  startDate: string;
  endDate: string;
  selectedWarehouseId: string;
  searchQuery: string;
  company: Company | null;
  warehouses: Warehouse[];
  suppliers: Supplier[];
  buyers: Buyer[];
  transactions: Transaction[];
  creditSuppliers: any[];
  debitSuppliers: any[];
  totalCreditBalance: number;
  totalDebitBalance: number;
  debitBuyers: any[];
  creditBuyers: any[];
  totalBuyerDebit: number;
  totalBuyerCredit: number;
  packagingInventory: Record<string, number>;
  filteredOperationalTx: Transaction[];
  filteredTransfers: any[];
  selectedCommodity: string;
  filteredJournal: JournalEntry[];
}

export const generatePDF = (data: PDFData) => {
  const {
    activeReport,
    startDate,
    endDate,
    selectedWarehouseId,
    searchQuery,
    company,
    warehouses,
    suppliers,
    buyers,
    transactions,
    creditSuppliers,
    debitSuppliers,
    totalCreditBalance,
    totalDebitBalance,
    debitBuyers,
    creditBuyers,
    totalBuyerDebit,
    totalBuyerCredit,
    packagingInventory,
    filteredOperationalTx,
    filteredTransfers,
    selectedCommodity,
    filteredJournal
  } = data;

  const doc = new jsPDF(activeReport === 'supplier_balances' ? 'p' : 'l');
  const timestamp = new Date().toLocaleString();
  
  // Company Header
  doc.setFontSize(22);
  doc.setTextColor(16, 185, 129); // Emerald-600
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.text(company?.name?.toUpperCase() || 'CCS COMMODITY CONTROL SYSTEM', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text('Financial & Commodity Management Solutions', pageWidth / 2, 28, { align: 'center' });
  
  doc.setDrawColor(200);
  doc.line(14, 34, pageWidth - 14, 34);

  doc.setFontSize(16);
  doc.setTextColor(0);
  
  let title = '';
  let tableData: any[] = [];
  let tableHeaders: string[] = [];

  if (activeReport === 'search') {
    title = `Transaction Search Results for: ${searchQuery}`;
    tableHeaders = ['Date', 'Type', 'Tranx ID', 'Entity', 'Phone', 'Commodity', 'Net Weight', 'Value (NGN)'];
    tableData = transactions
      .filter(t => t.storeRecordId?.toLowerCase().includes(searchQuery.toLowerCase()))
      .map(t => {
        const entity = t.type === 'PURCHASE' 
          ? suppliers.find(s => s.id === t.supplierId)
          : buyers.find(b => b.id === t.buyerId);
        
        return [
          new Date(t.date).toLocaleDateString(),
          t.type,
          t.storeRecordId || '-',
          entity?.name || (t.type === 'SALE' ? t.buyerName : 'Unknown'),
          entity?.phone || '-',
          t.commodity,
          `${formatNumber(t.netWeight)}kg`,
          formatNumber(t.totalValue || 0)
        ];
      });
  } else if (activeReport === 'supplier_balances') {
    title = `Supplier Balances Report (As at ${endDate})`;
    const warehouseName = selectedWarehouseId === 'ALL' ? 'All Warehouses' : warehouses.find(w => w.id === selectedWarehouseId)?.name || 'Unknown';
    title += ` | Warehouse: ${warehouseName}`;

    // Credit Table (We Owe)
    if (creditSuppliers.length > 0) {
      doc.setFontSize(14);
      doc.setTextColor(79, 70, 229); // Indigo-600
      doc.text('CREDIT BALANCES (ACCOUNTS PAYABLE - WE OWE)', 14, (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 15 : 52);
      
      autoTable(doc, {
        startY: (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 20 : 58,
        head: [['Supplier Name', 'Phone', 'Location', 'Balance (NGN)']],
        body: creditSuppliers.map(s => [s.name, s.phone || '-', s.location, formatNumber(s.balance)]),
        foot: [['TOTAL CREDIT', '', '', formatNumber(totalCreditBalance)]],
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] },
        footStyles: { fillColor: [243, 244, 246], textColor: [31, 41, 55], fontStyle: 'bold' },
        styles: { fontSize: 9 },
        columnStyles: { 3: { halign: 'right' } }
      });
    }
 
    // Debit Table (They Owe)
    if (debitSuppliers.length > 0) {
      doc.setFontSize(14);
      doc.setTextColor(225, 29, 72); // Rose-600
      doc.text('DEBIT BALANCES (ACCOUNTS RECEIVABLE - THEY OWE US)', 14, (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 15 : 52);
      
      autoTable(doc, {
        startY: (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 20 : 58,
        head: [['Supplier Name', 'Phone', 'Location', 'Balance (NGN)']],
        body: debitSuppliers.map(s => [s.name, s.phone || '-', s.location, formatNumber(Math.abs(s.balance))]),
        foot: [['TOTAL DEBIT', '', '', formatNumber(totalDebitBalance)]],
        theme: 'grid',
        headStyles: { fillColor: [225, 29, 72] },
        footStyles: { fillColor: [243, 244, 246], textColor: [31, 41, 55], fontStyle: 'bold' },
        styles: { fontSize: 9 },
        columnStyles: { 3: { halign: 'right' } }
      });
    }

    if (creditSuppliers.length === 0 && debitSuppliers.length === 0) {
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text('No active balances found for the selected criteria.', 14, 60);
    }
    
    doc.save(`supplier_balances_${new Date().getTime()}.pdf`);
  } else if (activeReport === 'buyer_balances') {
    title = `Customer Balances Report (As at ${endDate})`;
    const warehouseName = selectedWarehouseId === 'ALL' ? 'All Warehouses' : warehouses.find(w => w.id === selectedWarehouseId)?.name || 'Unknown';
    title += ` | Warehouse: ${warehouseName}`;

    // Debit Table (They Owe)
    if (debitBuyers.length > 0) {
      doc.setFontSize(14);
      doc.setTextColor(37, 99, 235); // Blue-600
      doc.text('DEBIT BALANCES (ACCOUNTS RECEIVABLE - THEY OWE US)', 14, (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 15 : 52);
      
      autoTable(doc, {
        startY: (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 20 : 58,
        head: [['Customer Name', 'Phone', 'Location', 'Balance (NGN)']],
        body: debitBuyers.map(b => [b.name, b.phone || '-', b.location, formatNumber(b.balance)]),
        foot: [['TOTAL DEBIT', '', '', formatNumber(totalBuyerDebit)]],
        theme: 'grid',
        headStyles: { fillColor: [37, 99, 235] },
        footStyles: { fillColor: [243, 244, 246], textColor: [31, 41, 55], fontStyle: 'bold' },
        styles: { fontSize: 9 },
        columnStyles: { 3: { halign: 'right' } }
      });
    }
 
    // Credit Table (We Owe)
    if (creditBuyers.length > 0) {
      doc.setFontSize(14);
      doc.setTextColor(5, 150, 105); // Emerald-600
      doc.text('CREDIT BALANCES (ACCOUNTS PAYABLE - WE OWE THEM)', 14, (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 15 : 52);
      
      autoTable(doc, {
        startY: (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 20 : 58,
        head: [['Customer Name', 'Phone', 'Location', 'Balance (NGN)']],
        body: creditBuyers.map(b => [b.name, b.phone || '-', b.location, formatNumber(Math.abs(b.balance))]),
        foot: [['TOTAL CREDIT', '', '', formatNumber(totalBuyerCredit)]],
        theme: 'grid',
        headStyles: { fillColor: [5, 150, 105] },
        footStyles: { fillColor: [243, 244, 246], textColor: [31, 41, 55], fontStyle: 'bold' },
        styles: { fontSize: 9 },
        columnStyles: { 3: { halign: 'right' } }
      });
    }

    if (debitBuyers.length === 0 && creditBuyers.length === 0) {
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text('No active balances found for the selected criteria.', 14, 60);
    }

    doc.save(`customer_balances_${new Date().getTime()}.pdf`);
  } else {
    if (activeReport === 'packaging_inventory') {
      title = `Packaging Inventory Report (As at ${endDate})`;
      tableHeaders = ['Packaging Type', 'Warehouse', 'Current Stock (Units)'];
      
      const warehouseName = selectedWarehouseId === 'ALL' ? 'All Warehouses' : warehouses.find(w => w.id === selectedWarehouseId)?.name || 'Unknown';
      tableData = Object.entries(packagingInventory).map(([type, qty]) => [
        type?.replace('_', ' ') || 'N/A',
        warehouseName,
        formatNumber(qty)
      ]);
    } else if (activeReport === 'transfers') {
      title = `Stock Transfers Report (${startDate} to ${endDate})`;
      tableHeaders = ['Date', 'Type', 'Item', 'From', 'To', 'Quantity/Weight'];
      tableData = filteredTransfers.map(t => [
        new Date(t.date).toLocaleDateString(),
        t.transferType,
        t.transferType === 'COMMODITY' ? (t as Transaction).commodity : (t as BagTransaction).packagingType.replace('_', ' '),
        warehouses.find(w => w.id === t.sourceWarehouseId)?.name || 'Unknown',
        warehouses.find(w => w.id === t.destinationWarehouseId)?.name || 'Unknown',
        t.transferType === 'COMMODITY' ? `${formatNumber((t as Transaction).netWeight)}kg` : `${formatNumber((t as BagTransaction).quantity)} units`
      ]);
    } else if (activeReport === 'journal') {
      title = `Financial Journal Report (${startDate} to ${endDate})`;
      tableHeaders = ['Date', 'Type', 'Category', 'Warehouse', 'Description', 'Inflow (NGN)', 'Outflow (NGN)'];
      
      const totalInflow = filteredJournal.filter(e => e.type === 'INFLOW').reduce((sum, e) => sum + (e.amount || 0), 0);
      const totalOutflow = filteredJournal.filter(e => e.type === 'OUTFLOW').reduce((sum, e) => sum + (e.amount || 0), 0);
      
      tableData = filteredJournal.map(e => [
        new Date(e.date).toLocaleDateString(),
        e.type,
        e.category.replace('_', ' '),
        warehouses.find(w => w.id === e.warehouseId)?.name || '-',
        e.description,
        e.type === 'INFLOW' ? formatNumber(e.amount) : '-',
        e.type === 'OUTFLOW' ? formatNumber(e.amount) : '-'
      ]);

      // Add footer logic manually since we are using autoTable below
    } else {
      title = activeReport === 'operational_purchases' ? 'Purchases Operational Report' : 'Sales Operational Report';
      tableHeaders = ['Date', 'Ref ID', 'Commodity', 'Warehouse', 'Bags', 'Gross', 'Ded', 'Net', 'Price/kg', 'Value (NGN)'];
      tableData = filteredOperationalTx.map(t => {
        let deductionBreakdown = '';
        if (t.deductions) {
          const d = t.deductions;
          const mLoss = ((d.moistureActual - d.moistureBenchmark) * (t.grossWeight || 0)) / 100;
          const parts = [];
          if (mLoss > 0) parts.push(`M: ${formatNumber(mLoss, 2)}kg`);
          if (d.tareWeight > 0) parts.push(`T: ${formatNumber(d.tareWeight, 2)}kg`);
          if (d.moldWeight > 0) parts.push(`Q: ${formatNumber(d.moldWeight, 2)}kg`);
          if (d.otherDeduction > 0) parts.push(`O: ${formatNumber(d.otherDeduction, 2)}kg`);
          deductionBreakdown = parts.join(', ');
        }

        const isManual = t.calculationMethod === 'MANUAL';

        return [
          new Date(t.date).toLocaleDateString(),
          t.referenceId,
          t.commodity + (isManual ? ' (Manual)' : ''),
          warehouses.find(w => w.id === t.warehouseId)?.name || t.warehouse || 'Main',
          formatNumber(t.noOfBags || t.bags || 0, 0),
          `${formatNumber(t.grossWeight)}kg`,
          `${formatNumber(t.grossWeight - t.netWeight)}kg${deductionBreakdown ? `\n(${deductionBreakdown})` : ''}`,
          `${formatNumber(t.netWeight)}kg`,
          t.pricePerKg ? `NGN ${formatNumber(t.pricePerKg)}` : '-',
          formatNumber(t.totalValue || 0)
        ];
      });
    }
  }

  if (activeReport !== 'supplier_balances' && activeReport !== 'buyer_balances') {
    doc.text(title, 14, 42);
    doc.setFontSize(11);
    doc.text(`Generated on: ${timestamp}`, 14, 48);
    
    const warehouseName = selectedWarehouseId === 'ALL' ? 'All Warehouses' : warehouses.find(w => w.id === selectedWarehouseId)?.name || 'Unknown';
    const commodityInfo = selectedCommodity === 'ALL' ? 'All Commodities' : selectedCommodity;
    doc.text(`Period: ${startDate} to ${endDate} | Warehouse: ${warehouseName} | Commodity: ${commodityInfo}`, 14, 54);
 
    autoTable(doc, {
      startY: (activeReport === 'search') ? 52 : 60,
      head: [tableHeaders],
      body: tableData,
      foot: (activeReport === 'operational_purchases' || activeReport === 'operational_sales') ? [
        ['TOTAL', '', '', '', 
          formatNumber(filteredOperationalTx.reduce((sum, t) => sum + (t.noOfBags || t.bags || 0), 0), 0),
          `${formatNumber(filteredOperationalTx.reduce((sum, t) => sum + t.grossWeight, 0))}kg`,
          `${formatNumber(filteredOperationalTx.reduce((sum, t) => sum + (t.grossWeight - t.netWeight), 0))}kg`,
          `${formatNumber(filteredOperationalTx.reduce((sum, t) => sum + t.netWeight, 0))}kg`,
          '',
          formatNumber(filteredOperationalTx.reduce((sum, t) => sum + (t.totalValue || 0), 0))
        ]
      ] : (activeReport === 'journal' ? [
        ['FINAL BALANCES', '', '', '', '', 
          formatNumber(filteredJournal.filter(e => e.type === 'INFLOW').reduce((sum, e) => sum + (e.amount || 0), 0)),
          formatNumber(filteredJournal.filter(e => e.type === 'OUTFLOW').reduce((sum, e) => sum + (e.amount || 0), 0))
        ]
      ] : undefined),
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
      footStyles: { fillColor: [243, 244, 246], textColor: [31, 41, 55], fontStyle: 'bold' },
      styles: { fontSize: 9 },
      columnStyles: activeReport === 'search' ? {
        6: { halign: 'right' },
        7: { halign: 'right' }
      } : (activeReport === 'packaging_inventory' ? {
        2: { halign: 'right' }
      } : (activeReport === 'transfers' ? {
        5: { halign: 'right' }
      } : (activeReport === 'journal' ? {
        5: { halign: 'right' },
        6: { halign: 'right' }
      } : {
        4: { halign: 'center' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'right' },
        9: { halign: 'right' }
      })))
    });

    doc.save(`${activeReport}_${new Date().getTime()}.pdf`);
  }
};
