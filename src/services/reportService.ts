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
  Company 
} from '../types';

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
    selectedCommodity
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
  doc.text('Financial & Commodity Management Solutions', pageWidth / 2, 26, { align: 'center' });
  
  doc.setDrawColor(200);
  doc.line(14, 32, pageWidth - 14, 32);

  doc.setFontSize(14);
  doc.setTextColor(0);
  
  let title = '';
  let tableData: any[] = [];
  let tableHeaders: string[] = [];

  if (activeReport === 'search') {
    title = `Transaction Search Results for: ${searchQuery}`;
    tableHeaders = ['Date', 'Type', 'Tranx ID', 'Entity', 'Commodity', 'Net Weight', 'Value (NGN)'];
    tableData = transactions
      .filter(t => t.storeRecordId?.toLowerCase().includes(searchQuery.toLowerCase()))
      .map(t => [
        new Date(t.date).toLocaleDateString(),
        t.type,
        t.storeRecordId || '-',
        t.type === 'PURCHASE' 
          ? (suppliers.find(s => s.id === t.supplierId)?.name || 'Unknown')
          : (buyers.find(b => b.id === t.buyerId)?.name || t.buyerName || 'Unknown'),
        t.commodity,
        `${t.netWeight}kg`,
        (t.totalValue || 0).toLocaleString()
      ]);
  } else if (activeReport === 'supplier_balances') {
    title = `Supplier Balances Report (As at ${endDate})`;
    const warehouseName = selectedWarehouseId === 'ALL' ? 'All Warehouses' : warehouses.find(w => w.id === selectedWarehouseId)?.name || 'Unknown';
    title += ` | Warehouse: ${warehouseName}`;

    // Credit Table (We Owe)
    if (creditSuppliers.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(79, 70, 229); // Indigo-600
      doc.text('CREDIT BALANCES (ACCOUNTS PAYABLE - WE OWE)', 14, (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 15 : 52);
      
      autoTable(doc, {
        startY: (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 20 : 58,
        head: [['Supplier Name', 'Location', 'Balance (NGN)']],
        body: creditSuppliers.map(s => [s.name, s.location, s.balance.toLocaleString()]),
        foot: [['TOTAL CREDIT', '', totalCreditBalance.toLocaleString()]],
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] },
        footStyles: { fillColor: [243, 244, 246], textColor: [31, 41, 55], fontStyle: 'bold' },
        styles: { fontSize: 8 },
        columnStyles: { 2: { halign: 'right' } }
      });
    }

    // Debit Table (They Owe)
    if (debitSuppliers.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(225, 29, 72); // Rose-600
      doc.text('DEBIT BALANCES (ACCOUNTS RECEIVABLE - THEY OWE US)', 14, (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 15 : 52);
      
      autoTable(doc, {
        startY: (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 20 : 58,
        head: [['Supplier Name', 'Location', 'Balance (NGN)']],
        body: debitSuppliers.map(s => [s.name, s.location, Math.abs(s.balance).toLocaleString()]),
        foot: [['TOTAL DEBIT', '', totalDebitBalance.toLocaleString()]],
        theme: 'grid',
        headStyles: { fillColor: [225, 29, 72] },
        footStyles: { fillColor: [243, 244, 246], textColor: [31, 41, 55], fontStyle: 'bold' },
        styles: { fontSize: 8 },
        columnStyles: { 2: { halign: 'right' } }
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
      doc.setFontSize(12);
      doc.setTextColor(37, 99, 235); // Blue-600
      doc.text('DEBIT BALANCES (ACCOUNTS RECEIVABLE - THEY OWE US)', 14, (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 15 : 52);
      
      autoTable(doc, {
        startY: (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 20 : 58,
        head: [['Customer Name', 'Location', 'Balance (NGN)']],
        body: debitBuyers.map(b => [b.name, b.location, b.balance.toLocaleString()]),
        foot: [['TOTAL DEBIT', '', totalBuyerDebit.toLocaleString()]],
        theme: 'grid',
        headStyles: { fillColor: [37, 99, 235] },
        footStyles: { fillColor: [243, 244, 246], textColor: [31, 41, 55], fontStyle: 'bold' },
        styles: { fontSize: 8 },
        columnStyles: { 2: { halign: 'right' } }
      });
    }

    // Credit Table (We Owe)
    if (creditBuyers.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(5, 150, 105); // Emerald-600
      doc.text('CREDIT BALANCES (ACCOUNTS PAYABLE - WE OWE THEM)', 14, (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 15 : 52);
      
      autoTable(doc, {
        startY: (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 20 : 58,
        head: [['Customer Name', 'Location', 'Balance (NGN)']],
        body: creditBuyers.map(b => [b.name, b.location, Math.abs(b.balance).toLocaleString()]),
        foot: [['TOTAL CREDIT', '', totalBuyerCredit.toLocaleString()]],
        theme: 'grid',
        headStyles: { fillColor: [5, 150, 105] },
        footStyles: { fillColor: [243, 244, 246], textColor: [31, 41, 55], fontStyle: 'bold' },
        styles: { fontSize: 8 },
        columnStyles: { 2: { halign: 'right' } }
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
        qty.toLocaleString()
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
        t.transferType === 'COMMODITY' ? `${(t as Transaction).netWeight}kg` : `${(t as BagTransaction).quantity} units`
      ]);
    } else {
      title = activeReport === 'operational_purchases' ? 'Purchases Operational Report' : 'Sales Operational Report';
      tableHeaders = ['Date', 'Ref ID', 'Commodity', 'Warehouse', 'Bags', 'Gross', 'Ded', 'Net', 'Price/kg', 'Value (NGN)'];
      tableData = filteredOperationalTx.map(t => {
        let deductionBreakdown = '';
        if (t.deductions) {
          const d = t.deductions;
          const mLoss = ((d.moistureActual - d.moistureBenchmark) * (t.grossWeight || 0)) / 100;
          const parts = [];
          if (mLoss > 0) parts.push(`M: ${mLoss.toFixed(2)}kg`);
          if (d.tareWeight > 0) parts.push(`T: ${d.tareWeight}kg`);
          if (d.moldWeight > 0) parts.push(`Q: ${d.moldWeight}kg`);
          if (d.otherDeduction > 0) parts.push(`O: ${d.otherDeduction}kg`);
          deductionBreakdown = parts.join(', ');
        }

        return [
          new Date(t.date).toLocaleDateString(),
          t.referenceId,
          t.commodity,
          warehouses.find(w => w.id === t.warehouseId)?.name || t.warehouse || 'Main',
          t.noOfBags || t.bags || '-',
          `${t.grossWeight}kg`,
          `${(t.grossWeight - t.netWeight).toFixed(2)}kg${deductionBreakdown ? `\n(${deductionBreakdown})` : ''}`,
          `${t.netWeight}kg`,
          t.pricePerKg ? `NGN ${t.pricePerKg.toLocaleString()}` : '-',
          (t.totalValue || 0).toLocaleString()
        ];
      });
    }
  }

  if (activeReport !== 'supplier_balances' && activeReport !== 'buyer_balances') {
    doc.text(title, 14, 42);
    doc.setFontSize(10);
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
          filteredOperationalTx.reduce((sum, t) => sum + (t.noOfBags || t.bags || 0), 0).toLocaleString(),
          `${filteredOperationalTx.reduce((sum, t) => sum + t.grossWeight, 0).toLocaleString()}kg`,
          `${filteredOperationalTx.reduce((sum, t) => sum + (t.grossWeight - t.netWeight), 0).toFixed(2)}kg`,
          `${filteredOperationalTx.reduce((sum, t) => sum + t.netWeight, 0).toLocaleString()}kg`,
          '',
          filteredOperationalTx.reduce((sum, t) => sum + (t.totalValue || 0), 0).toLocaleString()
        ]
      ] : undefined,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
      footStyles: { fillColor: [243, 244, 246], textColor: [31, 41, 55], fontStyle: 'bold' },
      styles: { fontSize: 8 },
      columnStyles: {
        4: { halign: 'center' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'right' },
        9: { halign: 'right' }
      }
    });

    doc.save(`${activeReport}_${new Date().getTime()}.pdf`);
  }
};
