import { describe, expect, it } from 'vitest';
import {
  buildCashMovements,
  computeBuyerBalance,
  computeMonthlyPayroll,
  computeNetWeight,
  computeStockLevels,
  computeSupplierBalance,
  diffEffects,
  estimateProfit,
  isCashJournalEntry,
  levelsByItem,
  moistureLossKg,
  stockKey,
  summarizeCash,
  supplierBagBalance,
  taxRegimeForMonth,
  transactionStockEffects,
} from '../finance';
import type { BagTransaction, JournalEntry, Payment, Transaction } from '../../types';

const deductions = { moistureActual: 8, moistureBenchmark: 8, tareWeight: 0, moldWeight: 0, otherDeduction: 0 };

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: partial.id || Math.random().toString(36).slice(2),
    companyId: 'c1',
    date: '2026-03-10T11:00:00.000Z',
    type: 'PURCHASE',
    commodity: 'COCOA',
    grossWeight: 0,
    netWeight: 0,
    bags: 0,
    deductions,
    referenceId: 'R',
    ...partial,
  };
}

function je(partial: Partial<JournalEntry>): JournalEntry {
  return {
    id: partial.id || Math.random().toString(36).slice(2),
    companyId: 'c1',
    warehouseId: 'w1',
    date: '2026-03-10T11:00:00.000Z',
    type: 'OUTFLOW',
    category: 'TRANSPORT',
    amount: 0,
    description: '',
    paymentMethod: 'CASH',
    ...partial,
  };
}

describe('moisture and net weight', () => {
  it('deducts only when actual moisture exceeds the benchmark', () => {
    expect(moistureLossKg(10, 8, 1000)).toBe(20);
    expect(moistureLossKg(6, 8, 1000)).toBe(0);
    expect(moistureLossKg(8, 8, 1000)).toBe(0);
  });

  it('never produces a net weight above gross or below zero', () => {
    expect(computeNetWeight({ grossWeight: 1000, moistureActual: 5, moistureBenchmark: 8 }).netWeight).toBe(1000);
    expect(computeNetWeight({ grossWeight: 1000, moistureActual: 10, moistureBenchmark: 8, tareWeight: 5, moldWeight: 3, otherDeduction: 2 }).netWeight).toBe(970);
    expect(computeNetWeight({ grossWeight: 10, moistureActual: 8, moistureBenchmark: 8, tareWeight: 50 }).netWeight).toBe(0);
  });

  it('ignores negative deduction inputs', () => {
    expect(computeNetWeight({ grossWeight: 100, moistureActual: 8, moistureBenchmark: 8, tareWeight: -40 }).netWeight).toBe(100);
  });
});

describe('supplier balance', () => {
  const supplier = { id: 's1', previousBalance: 1000 };

  it('credits purchases and debits returns, payments and charges', () => {
    const balance = computeSupplierBalance(supplier, {
      transactions: [
        tx({ supplierId: 's1', type: 'PURCHASE', totalValue: 5000 }),
        tx({ supplierId: 's1', type: 'PURCHASE_RETURN', totalValue: 500 }),
        tx({ supplierId: 's1', type: 'PURCHASE', totalValue: 9999, isDeleted: true }),
        tx({ supplierId: 'other', type: 'PURCHASE', totalValue: 7777 }),
      ],
      payments: [{ id: 'p1', companyId: 'c1', warehouseId: 'w1', date: '2026-03-11T11:00:00.000Z', supplierId: 's1', amount: 2000, method: 'CASH', reference: '', description: '' }],
      journal: [
        je({ supplierId: 's1', type: 'OUTFLOW', category: 'SUPPLIER_CHARGE', amount: 300 }),
        je({ supplierId: 's1', type: 'INFLOW', category: 'SUPPLIER_EXPENSE_DEDUCTION', amount: 100 }),
      ],
    });
    expect(balance).toBe(1000 + 5000 - 500 - 2000 - 300 + 100);
  });

  it('credits the supplier for a direct-delivery sale and debits a supplier who buys', () => {
    const data = {
      transactions: [
        tx({ supplierId: 's1', type: 'SALE', isDirectDelivery: true, totalValue: 8000, supplierCreditValue: 7000 }),
        tx({ supplierId: 's1', type: 'SALE', isDirectDelivery: true, totalValue: 3000 }),
        tx({ supplierId: 's1', type: 'SALE', totalValue: 1500 }),
      ],
      payments: [],
      journal: [],
    };
    expect(computeSupplierBalance({ id: 's1', previousBalance: 0 }, data)).toBe(7000 + 3000 - 1500);
  });

  it('respects the as-of date and warehouse filters', () => {
    const data = {
      transactions: [
        tx({ supplierId: 's1', totalValue: 100, date: '2026-01-05T11:00:00.000Z', warehouseId: 'w1' }),
        tx({ supplierId: 's1', totalValue: 200, date: '2026-02-05T11:00:00.000Z', warehouseId: 'w2' }),
      ],
      payments: [],
      journal: [],
    };
    expect(computeSupplierBalance({ id: 's1', previousBalance: 0 }, data, { asOf: '2026-01-31' })).toBe(100);
    expect(computeSupplierBalance({ id: 's1', previousBalance: 0 }, data, { warehouseId: 'w2' })).toBe(200);
  });
});

describe('buyer balance', () => {
  it('debits sales and charges, credits returns and receipts', () => {
    const balance = computeBuyerBalance({ id: 'b1', previousBalance: 50 }, {
      transactions: [
        tx({ buyerId: 'b1', type: 'SALE', totalValue: 1000 }),
        tx({ buyerId: 'b1', type: 'SALES_RETURN', totalValue: 100 }),
      ],
      journal: [
        je({ buyerId: 'b1', type: 'INFLOW', category: 'PART_PAYMENT', amount: 400, excludeFromJournal: true }),
        je({ buyerId: 'b1', type: 'OUTFLOW', category: 'CUSTOMER_CHARGE', amount: 25, excludeFromJournal: true }),
      ],
    });
    expect(balance).toBe(50 + 1000 - 100 - 400 + 25);
  });
});

describe('cash book', () => {
  it('is built from journal entries only, leaving supplier payments to the supplier ledger', () => {
    const journal = [
      je({ id: 'j1', type: 'INFLOW', category: 'CAPITAL', amount: 10000, paymentMethod: 'BANK_TRANSFER' }),
      je({ id: 'j2', type: 'OUTFLOW', category: 'TRANSPORT', amount: 500 }),
      je({ id: 'j3', type: 'INFLOW', category: 'PART_PAYMENT', amount: 700, excludeFromJournal: true, buyerId: 'b1' }),
      je({ id: 'j4', type: 'OUTFLOW', category: 'SUPPLIER_CHARGE', amount: 900, excludeFromJournal: true, supplierId: 's1' }),
      je({ id: 'j5', type: 'OUTFLOW', category: 'PETTY CASH RETIREMENT', amount: 400 }),
      je({ id: 'j6', type: 'OUTFLOW', category: 'TRANSPORT', amount: 999, isDeleted: true }),
    ];
    const movements = buildCashMovements(journal);
    const summary = summarizeCash(movements);
    // Supplier payments never enter the cash book, however many exist.
    expect(movements.every(m => m.source === 'JOURNAL')).toBe(true);
    expect(summary.cash).toBe(-500 + 700);
    expect(summary.bank).toBe(10000);
    expect(summary.inflow).toBe(10700);
    expect(summary.outflow).toBe(500);
    expect(isCashJournalEntry(journal[4])).toBe(false);
  });
});

describe('stock ledger', () => {
  it('computes per-warehouse stock including transfers and direct deliveries', () => {
    const levels = computeStockLevels({
      transactions: [
        tx({ type: 'PURCHASE', warehouseId: 'w1', netWeight: 1000 }),
        tx({ type: 'SALE', warehouseId: 'w1', netWeight: 300 }),
        tx({ type: 'SALE', warehouseId: 'w1', netWeight: 5000, isDirectDelivery: true }),
        tx({ type: 'TRANSFER', sourceWarehouseId: 'w1', destinationWarehouseId: 'w2', netWeight: 200 }),
        tx({ type: 'PURCHASE_RETURN', warehouseId: 'w1', netWeight: 50 }),
        tx({ type: 'PURCHASE', warehouseId: 'w2', netWeight: 999, isDeleted: true }),
      ],
      adjustments: [
        { id: 'a1', companyId: 'c1', date: '', postingDate: '', commodity: 'COCOA', warehouseId: 'w2', adjustmentType: 'WEIGHT_LOSS', adjustmentDirection: 'REMOVE', netWeight: 20, bags: 0, createdBy: 'u', creatorEmail: 'e' },
      ],
    });
    expect(levels[stockKey('COMMODITY', 'w1', 'COCOA')]).toBe(450);
    expect(levels[stockKey('COMMODITY', 'w2', 'COCOA')]).toBe(180);
    expect(levelsByItem(levels, 'COMMODITY').COCOA).toBe(630);
  });

  it('diffs edits so only the net change is applied', () => {
    const before = tx({ id: 't', type: 'SALE', warehouseId: 'w1', netWeight: 300 });
    const after = { ...before, netWeight: 450 };
    expect(diffEffects(transactionStockEffects(before), transactionStockEffects(after))).toEqual({ [stockKey('COMMODITY', 'w1', 'COCOA')]: -150 });
    expect(diffEffects(transactionStockEffects(before), transactionStockEffects({ ...before, isDeleted: true }))).toEqual({ [stockKey('COMMODITY', 'w1', 'COCOA')]: 300 });
    expect(diffEffects(transactionStockEffects(before), transactionStockEffects({ ...before, notes: 'x' }))).toEqual({});
  });

  it('tracks bags held by suppliers', () => {
    const bags: BagTransaction[] = [
      { id: '1', companyId: 'c1', date: '', supplierId: 's1', type: 'ISSUE', packagingType: 'JUTE_BAG', quantity: 100, reference: '' },
      { id: '2', companyId: 'c1', date: '', supplierId: 's1', type: 'RETURN', packagingType: 'JUTE_BAG', quantity: 30, reference: '' },
      { id: '3', companyId: 'c1', date: '', supplierId: 's1', type: 'STOCK_IN', packagingType: 'JUTE_BAG', quantity: 500, reference: '' },
    ];
    expect(supplierBagBalance(bags, 's1')).toBe(70);
  });
});

describe('payroll', () => {
  it('selects the tax regime by payroll month', () => {
    expect(taxRegimeForMonth('2025-12')).toBe('PITA_2011');
    expect(taxRegimeForMonth('2026-01')).toBe('NTA_2025');
  });

  it('honours the pension and PAYE toggles', () => {
    const noPension = computeMonthlyPayroll({ basicSalary: 300000, allowances: 0, applyPension: false, applyPAYE: false, month: '2026-03' });
    expect(noPension.pension).toBe(0);
    expect(noPension.paye).toBe(0);
    expect(noPension.netPay).toBe(300000);
  });

  it('exempts the first ₦800,000 of annual taxable income under NTA 2025', () => {
    // ₦70,000/month gross, 8% pension → annual taxable 772,800 < 800,000
    const low = computeMonthlyPayroll({ basicSalary: 70000, month: '2026-03' });
    expect(low.paye).toBe(0);
    expect(low.pension).toBe(5600);
    expect(low.netPay).toBe(64400);
  });

  it('applies NTA 2025 bands and rent relief', () => {
    // Gross 500,000/month → annual 6,000,000; pension 480,000; rent relief min(500k, 20% of 3m)=500,000
    // Taxable 5,020,000 → 0 on 800k + 15% of 2.2m (330,000) + 18% of 2,020,000 (363,600) = 693,600/yr
    const r = computeMonthlyPayroll({ basicSalary: 400000, allowances: 100000, annualRent: 3_000_000, month: '2026-05' });
    expect(r.taxRegime).toBe('NTA_2025');
    expect(r.paye).toBe(57800);
    expect(r.netPay).toBe(500000 - 40000 - 57800);
  });

  it('keeps PITA 2011 with CRA and minimum tax for 2025 payroll', () => {
    const r = computeMonthlyPayroll({ basicSalary: 500000, month: '2025-06' });
    // annual gross 6,000,000; CRA 200,000 + 1,200,000 = 1,400,000; pension 480,000; taxable 4,120,000
    // tax: 21,000 + 33,000 + 75,000 + 95,000 + 21%×1,600,000 (336,000) + 24%×920,000 (220,800) = 780,800
    expect(r.taxRegime).toBe('PITA_2011');
    expect(r.paye).toBe(65066.67);
  });

  it('subtracts other deductions from net pay', () => {
    const r = computeMonthlyPayroll({ basicSalary: 100000, applyPAYE: false, otherDeductions: 10000, month: '2026-01' });
    expect(r.netPay).toBe(100000 - 8000 - 10000);
  });
});

describe('profit estimate', () => {
  it('uses cost of goods sold and excludes capital and loans', () => {
    const transactions = [
      tx({ type: 'PURCHASE', netWeight: 1000, totalValue: 1_000_000, date: '2026-03-01T11:00:00.000Z' }),
      tx({ type: 'SALE', netWeight: 600, totalValue: 900_000, date: '2026-03-15T11:00:00.000Z' }),
    ];
    const journal = [
      je({ type: 'INFLOW', category: 'CAPITAL', amount: 5_000_000, date: '2026-03-02T11:00:00.000Z' }),
      je({ type: 'INFLOW', category: 'LOAN', amount: 2_000_000, date: '2026-03-02T11:00:00.000Z' }),
      je({ type: 'OUTFLOW', category: 'TRANSPORT', amount: 50_000, date: '2026-03-05T11:00:00.000Z' }),
      je({ type: 'OUTFLOW', category: 'ASSET PURCHASE', amount: 3_000_000, date: '2026-03-05T11:00:00.000Z' }),
    ];
    const p = estimateProfit(transactions, journal, { start: '2026-03-01', end: '2026-03-31' });
    expect(p.revenue).toBe(900_000);
    expect(p.costOfGoodsSold).toBe(600_000);
    expect(p.grossProfit).toBe(300_000);
    expect(p.operatingExpenses).toBe(50_000);
    expect(p.netProfit).toBe(250_000);
  });
});

describe('sub-kilogram precision', () => {
  it('keeps small fractional weights through the net-weight calculation', () => {
    const result = computeNetWeight({
      grossWeight: 0.2222, moistureActual: 8, moistureBenchmark: 8, tareWeight: 0, moldWeight: 0, otherDeduction: 0,
    });
    expect(result.netWeight).toBe(0.2222);
  });

  it('keeps fractional deductions instead of rounding them away', () => {
    const result = computeNetWeight({
      grossWeight: 1, moistureActual: 8, moistureBenchmark: 8, tareWeight: 0.0004, moldWeight: 0, otherDeduction: 0,
    });
    expect(result.totalDeductions).toBe(0.0004);
    expect(result.netWeight).toBe(0.9996);
  });

  it('carries a fractional moisture loss', () => {
    // 0.01% of 2.5kg = 0.00025kg, which 2dp rounding would have erased.
    expect(moistureLossKg(8.01, 8, 2.5)).toBe(0.00025);
  });

  it('does not discard a small stock movement as rounding noise', () => {
    const delta = diffEffects([], [{ key: stockKey('COMMODITY', 'w1', 'COCOA'), quantity: 0.0002 }]);
    expect(delta[stockKey('COMMODITY', 'w1', 'COCOA')]).toBe(0.0002);
  });

  it('sums fractional movements without drift', () => {
    const key = stockKey('COMMODITY', 'w1', 'COCOA');
    const levels = computeStockLevels({
      transactions: [
        { id: 'a', companyId: 'c', date: '2026-01-01', type: 'PURCHASE', commodity: 'COCOA', warehouseId: 'w1', grossWeight: 0.2222, netWeight: 0.2222, bags: 0, referenceId: 'r', deductions: { moistureActual: 0, moistureBenchmark: 0, tareWeight: 0, moldWeight: 0, otherDeduction: 0 } },
        { id: 'b', companyId: 'c', date: '2026-01-02', type: 'SALE', commodity: 'COCOA', warehouseId: 'w1', grossWeight: 0.1111, netWeight: 0.1111, bags: 0, referenceId: 'r', deductions: { moistureActual: 0, moistureBenchmark: 0, tareWeight: 0, moldWeight: 0, otherDeduction: 0 } },
      ] as never,
    });
    expect(levels[key]).toBe(0.1111);
  });
});
