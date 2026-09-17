/**
 * Pure business calculations. Every screen, report and PDF must use these functions so
 * balances, stock and payroll figures are identical everywhere. Covered by unit tests in
 * src/lib/__tests__/finance.test.ts.
 */

import type {
  BagTransaction,
  Buyer,
  InventoryAdjustment,
  JournalEntry,
  Payment,
  PettyCashTransaction,
  StockLedger,
  StoreRecord,
  Supplier,
  TaxRegime,
  Transaction,
} from '../types';
import { roundTo, roundWeight, toNumber } from './utils';
import { isoToLocalDate } from './dates';

const round2 = (n: number) => roundTo(n, 2);
const positive = (v: unknown) => Math.max(0, toNumber(v));

// ---------------------------------------------------------------------------
// Weights & deductions
// ---------------------------------------------------------------------------

export const MOISTURE_BENCHMARKS: Record<string, number> = { COCOA: 8, CASHEW: 10, PK: 8 };

export function benchmarkFor(commodity: string | undefined): number {
  return MOISTURE_BENCHMARKS[commodity || ''] ?? 8;
}

/** Moisture deduction only applies when actual moisture is ABOVE the benchmark. */
export function moistureLossKg(actual: unknown, benchmark: unknown, grossWeight: unknown): number {
  const a = toNumber(actual);
  const b = toNumber(benchmark);
  const g = positive(grossWeight);
  if (a <= b || g <= 0) return 0;
  return roundWeight(((a - b) * g) / 100);
}

export interface NetWeightInput {
  grossWeight: unknown;
  moistureActual: unknown;
  moistureBenchmark: unknown;
  tareWeight?: unknown;
  moldWeight?: unknown;
  otherDeduction?: unknown;
}

export function computeNetWeight(input: NetWeightInput) {
  const gross = positive(input.grossWeight);
  const moistureLoss = moistureLossKg(input.moistureActual, input.moistureBenchmark, gross);
  const totalDeductions = roundWeight(
    moistureLoss + positive(input.tareWeight) + positive(input.moldWeight) + positive(input.otherDeduction)
  );
  return {
    moistureLoss,
    totalDeductions,
    netWeight: Math.max(0, roundWeight(gross - totalDeductions)),
  };
}

// ---------------------------------------------------------------------------
// Supplier & buyer ledgers
// ---------------------------------------------------------------------------

export interface LedgerEffect {
  credit: number;
  debit: number;
}

const NONE: LedgerEffect = { credit: 0, debit: 0 };

interface DatedFilter {
  /** Inclusive local YYYY-MM-DD upper bound. */
  asOf?: string;
  /** Restrict to a warehouse ('ALL' or undefined = all). */
  warehouseId?: string;
}

function passesFilter(doc: { date?: string; warehouseId?: string }, filter?: DatedFilter): boolean {
  if (!filter) return true;
  if (filter.asOf) {
    const day = isoToLocalDate(doc.date);
    if (!day || day > filter.asOf) return false;
  }
  if (filter.warehouseId && filter.warehouseId !== 'ALL' && doc.warehouseId !== filter.warehouseId) return false;
  return true;
}

/**
 * Effect of a transaction on a supplier ledger. Credit = we owe the supplier more.
 *  - PURCHASE: credit
 *  - PURCHASE_RETURN: debit
 *  - SALE to a supplier ("supplier as buyer"): debit
 *  - Direct-delivery SALE sourced from a supplier: credit (the supplier delivered on our behalf)
 */
export function transactionSupplierEffect(t: Transaction): LedgerEffect {
  if (t.isDeleted || !t.supplierId) return NONE;
  const value = round2(positive(t.totalValue));
  switch (t.type) {
    case 'PURCHASE':
      return { credit: value, debit: 0 };
    case 'PURCHASE_RETURN':
      return { credit: 0, debit: value };
    case 'SALE':
      if (t.isDirectDelivery) {
        const owed = t.supplierCreditValue !== undefined ? positive(t.supplierCreditValue) : value;
        return { credit: round2(owed), debit: 0 };
      }
      return { credit: 0, debit: value };
    default:
      return NONE;
  }
}

export function paymentSupplierEffect(p: Payment): LedgerEffect {
  if (p.isDeleted) return NONE;
  return { credit: 0, debit: round2(positive(p.amount)) };
}

/** Journal lines linked to a supplier: expense deductions and inflows credit; other outflows (charges) debit. */
export function journalSupplierEffect(e: JournalEntry): LedgerEffect {
  if (e.isDeleted || !e.supplierId) return NONE;
  const amount = round2(positive(e.amount));
  if (e.category === 'SUPPLIER_EXPENSE_DEDUCTION' || e.type === 'INFLOW') return { credit: amount, debit: 0 };
  return { credit: 0, debit: amount };
}

export interface SupplierLedgerData {
  transactions: Transaction[];
  payments: Payment[];
  journal: JournalEntry[];
}

export function computeSupplierBalance(supplier: Pick<Supplier, 'id' | 'previousBalance'>, data: SupplierLedgerData, filter?: DatedFilter): number {
  let balance = toNumber(supplier.previousBalance);
  for (const t of data.transactions) {
    if (t.supplierId !== supplier.id || !passesFilter(t, filter)) continue;
    const e = transactionSupplierEffect(t);
    balance += e.credit - e.debit;
  }
  for (const p of data.payments) {
    if (p.supplierId !== supplier.id || !passesFilter(p, filter)) continue;
    balance -= paymentSupplierEffect(p).debit;
  }
  for (const j of data.journal) {
    if (j.supplierId !== supplier.id || !passesFilter(j, filter)) continue;
    const e = journalSupplierEffect(j);
    balance += e.credit - e.debit;
  }
  return round2(balance);
}

/** Buyer ledger: debit = the buyer owes us more. */
export function transactionBuyerEffect(t: Transaction): LedgerEffect {
  if (t.isDeleted || !t.buyerId) return NONE;
  const value = round2(positive(t.totalValue));
  if (t.type === 'SALE') return { credit: 0, debit: value };
  if (t.type === 'SALES_RETURN') return { credit: value, debit: 0 };
  return NONE;
}

export function journalBuyerEffect(e: JournalEntry): LedgerEffect {
  if (e.isDeleted || !e.buyerId) return NONE;
  const amount = round2(positive(e.amount));
  return e.type === 'INFLOW' ? { credit: amount, debit: 0 } : { credit: 0, debit: amount };
}

export interface BuyerLedgerData {
  transactions: Transaction[];
  journal: JournalEntry[];
}

export function computeBuyerBalance(buyer: Pick<Buyer, 'id' | 'previousBalance'>, data: BuyerLedgerData, filter?: DatedFilter): number {
  let balance = toNumber(buyer.previousBalance);
  for (const t of data.transactions) {
    if (t.buyerId !== buyer.id || !passesFilter(t, filter)) continue;
    const e = transactionBuyerEffect(t);
    balance += e.debit - e.credit;
  }
  for (const j of data.journal) {
    if (j.buyerId !== buyer.id || !passesFilter(j, filter)) continue;
    const e = journalBuyerEffect(j);
    balance += e.debit - e.credit;
  }
  return round2(balance);
}

// ---------------------------------------------------------------------------
// Cash book
// ---------------------------------------------------------------------------

/** Journal categories that record obligations or expense recognition, not a movement of cash. */
export const NON_CASH_JOURNAL_CATEGORIES = new Set([
  'SUPPLIER_CHARGE',
  'SUPPLIER_EXPENSE_DEDUCTION',
  'CUSTOMER_CHARGE',
  // Cash already left the main book when the petty cash box was funded (category PETTY CASH).
  'PETTY CASH RETIREMENT',
]);

export function isCashJournalEntry(e: JournalEntry): boolean {
  if (e.isDeleted) return false;
  if (e.cashEffect === false) return false;
  if (e.cashEffect === true) return true;
  if (NON_CASH_JOURNAL_CATEGORIES.has(e.category)) return false;
  // Customer receipts recorded from the buyer ledger are real cash even though they were hidden from the list.
  if (e.excludeFromJournal && e.category !== 'PART_PAYMENT') return false;
  return true;
}

export type CashChannel = 'CASH' | 'BANK' | 'OTHER';

export function channelFor(method: string | undefined): CashChannel {
  if (!method || method === 'CASH') return 'CASH';
  if (method === 'BANK_TRANSFER' || method === 'CHECK' || method === 'CHEQUE') return 'BANK';
  return 'OTHER';
}

export interface CashMovement {
  id: string;
  source: 'JOURNAL' | 'SUPPLIER_PAYMENT';
  date: string;
  postingDate?: string;
  warehouseId: string;
  direction: 'IN' | 'OUT';
  amount: number;
  channel: CashChannel;
  method?: string;
  category: string;
  description: string;
  supplierId?: string;
  buyerId?: string;
  reference?: string;
  journal?: JournalEntry;
  payment?: Payment;
}

export function buildCashMovements(journal: JournalEntry[], payments: Payment[]): CashMovement[] {
  const movements: CashMovement[] = [];
  for (const e of journal) {
    if (!isCashJournalEntry(e)) continue;
    movements.push({
      id: e.id,
      source: 'JOURNAL',
      date: e.date,
      postingDate: e.postingDate,
      warehouseId: e.warehouseId,
      direction: e.type === 'INFLOW' ? 'IN' : 'OUT',
      amount: round2(positive(e.amount)),
      channel: channelFor(e.paymentMethod),
      method: e.paymentMethod,
      category: e.category,
      description: e.description,
      supplierId: e.supplierId,
      buyerId: e.buyerId,
      reference: e.reference,
      journal: e,
    });
  }
  for (const p of payments) {
    if (p.isDeleted) continue;
    movements.push({
      id: p.id,
      source: 'SUPPLIER_PAYMENT',
      date: p.date,
      postingDate: p.postingDate,
      warehouseId: p.warehouseId,
      direction: 'OUT',
      amount: round2(positive(p.amount)),
      channel: channelFor(p.method),
      method: p.method,
      category: 'SUPPLIER PAYMENT',
      description: p.description,
      supplierId: p.supplierId,
      reference: p.reference,
      payment: p,
    });
  }
  return movements;
}

export function summarizeCash(movements: CashMovement[], filter?: { warehouseId?: string; start?: string; end?: string }) {
  const totals = { cash: 0, bank: 0, other: 0, inflow: 0, outflow: 0 };
  for (const m of movements) {
    if (filter?.warehouseId && filter.warehouseId !== 'ALL' && m.warehouseId !== filter.warehouseId) continue;
    const day = isoToLocalDate(m.date);
    if (filter?.start && day < filter.start) continue;
    if (filter?.end && day > filter.end) continue;
    const signed = m.direction === 'IN' ? m.amount : -m.amount;
    if (m.channel === 'CASH') totals.cash += signed;
    else if (m.channel === 'BANK') totals.bank += signed;
    else totals.other += signed;
    if (m.direction === 'IN') totals.inflow += m.amount;
    else totals.outflow += m.amount;
  }
  return {
    cash: round2(totals.cash),
    bank: round2(totals.bank),
    other: round2(totals.other),
    inflow: round2(totals.inflow),
    outflow: round2(totals.outflow),
    net: round2(totals.inflow - totals.outflow),
  };
}

// ---------------------------------------------------------------------------
// Stock ledgers (commodities, bags, store-keeper records, petty cash float)
// ---------------------------------------------------------------------------

export interface StockEffect {
  key: string;
  quantity: number;
}

export function stockKey(ledger: StockLedger, warehouseId: string | undefined, item: string): string {
  return `${ledger}|${warehouseId || ''}|${item}`;
}

export function parseStockKey(key: string): { ledger: StockLedger; warehouseId: string; item: string } {
  const [ledger, warehouseId, ...rest] = key.split('|');
  return { ledger: ledger as StockLedger, warehouseId, item: rest.join('|') };
}

export function transactionStockEffects(t: Transaction | null | undefined): StockEffect[] {
  if (!t || t.isDeleted) return [];
  const kg = positive(t.netWeight);
  if (kg === 0) return [];
  const item = t.commodity;
  switch (t.type) {
    case 'PURCHASE':
      return [{ key: stockKey('COMMODITY', t.warehouseId, item), quantity: kg }];
    case 'SALE':
      return t.isDirectDelivery ? [] : [{ key: stockKey('COMMODITY', t.warehouseId, item), quantity: -kg }];
    case 'PURCHASE_RETURN':
      return [{ key: stockKey('COMMODITY', t.warehouseId, item), quantity: -kg }];
    case 'SALES_RETURN':
      return t.isDirectDelivery ? [] : [{ key: stockKey('COMMODITY', t.warehouseId, item), quantity: kg }];
    case 'TRANSFER':
      return [
        { key: stockKey('COMMODITY', t.sourceWarehouseId, item), quantity: -kg },
        { key: stockKey('COMMODITY', t.destinationWarehouseId, item), quantity: kg },
      ];
    default:
      return [];
  }
}

export function adjustmentStockEffects(a: InventoryAdjustment | null | undefined): StockEffect[] {
  if (!a || a.isDeleted) return [];
  const kg = positive(a.netWeight);
  if (kg === 0) return [];
  return [{ key: stockKey('COMMODITY', a.warehouseId, a.commodity), quantity: a.adjustmentDirection === 'ADD' ? kg : -kg }];
}

export function bagStockEffects(b: BagTransaction | null | undefined): StockEffect[] {
  if (!b || b.isDeleted) return [];
  const qty = positive(b.quantity);
  if (qty === 0) return [];
  switch (b.type) {
    case 'STOCK_IN':
    case 'RETURN':
      return [{ key: stockKey('BAG', b.warehouseId, b.packagingType), quantity: qty }];
    case 'ISSUE':
      return [{ key: stockKey('BAG', b.warehouseId, b.packagingType), quantity: -qty }];
    case 'TRANSFER':
      return [
        { key: stockKey('BAG', b.sourceWarehouseId, b.packagingType), quantity: -qty },
        { key: stockKey('BAG', b.destinationWarehouseId, b.packagingType), quantity: qty },
      ];
    default:
      return [];
  }
}

export function storeRecordStockEffects(r: StoreRecord | null | undefined): StockEffect[] {
  if (!r || r.isDeleted) return [];
  const kg = positive(r.actualWeight);
  if (kg === 0) return [];
  if (r.type === 'TRANSFER') {
    return [
      { key: stockKey('STORE', r.sourceWarehouseId, r.commodity), quantity: -kg },
      { key: stockKey('STORE', r.destinationWarehouseId, r.commodity), quantity: kg },
    ];
  }
  return [{ key: stockKey('STORE', r.warehouseId, r.commodity), quantity: r.type === 'IN' ? kg : -kg }];
}

export function pettyCashEffects(p: PettyCashTransaction | null | undefined): StockEffect[] {
  if (!p || p.isDeleted) return [];
  const amount = positive(p.amount);
  if (amount === 0) return [];
  return [{ key: stockKey('PETTY_CASH', p.warehouseId, 'NGN'), quantity: p.type === 'DISBURSEMENT' ? amount : -amount }];
}

export function sumEffects(effects: StockEffect[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of effects) {
    out[e.key] = (out[e.key] || 0) + e.quantity;
  }
  for (const k of Object.keys(out)) out[k] = roundWeight(out[k]);
  return out;
}

/** Net change per key when a document moves from `before` to `after` (either may be null). */
export function diffEffects(before: StockEffect[], after: StockEffect[]): Record<string, number> {
  const delta = sumEffects(after);
  for (const e of before) {
    delta[e.key] = roundWeight((delta[e.key] || 0) - e.quantity);
  }
  for (const k of Object.keys(delta)) {
    // Only discard floating-point noise, never a real movement: 0.0002kg is a valid delta.
    if (Math.abs(delta[k]) < 5e-6) delete delta[k];
  }
  return delta;
}

export interface StockSources {
  transactions?: Transaction[];
  adjustments?: InventoryAdjustment[];
  bagTransactions?: BagTransaction[];
  storeRecords?: StoreRecord[];
  pettyCash?: PettyCashTransaction[];
}

export function computeStockLevels(sources: StockSources): Record<string, number> {
  const effects: StockEffect[] = [];
  sources.transactions?.forEach(t => effects.push(...transactionStockEffects(t)));
  sources.adjustments?.forEach(a => effects.push(...adjustmentStockEffects(a)));
  sources.bagTransactions?.forEach(b => effects.push(...bagStockEffects(b)));
  sources.storeRecords?.forEach(r => effects.push(...storeRecordStockEffects(r)));
  sources.pettyCash?.forEach(p => effects.push(...pettyCashEffects(p)));
  return sumEffects(effects);
}

/** Sums a ledger by item, optionally restricted to one warehouse ('ALL' = every warehouse). */
export function levelsByItem(levels: Record<string, number>, ledger: StockLedger, warehouseId: string = 'ALL'): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, qty] of Object.entries(levels)) {
    const parsed = parseStockKey(key);
    if (parsed.ledger !== ledger) continue;
    if (warehouseId !== 'ALL' && parsed.warehouseId !== warehouseId) continue;
    out[parsed.item] = roundWeight((out[parsed.item] || 0) + qty);
  }
  return out;
}

export function levelFor(levels: Record<string, number>, ledger: StockLedger, warehouseId: string, item: string): number {
  return levels[stockKey(ledger, warehouseId, item)] || 0;
}

/** Bag balance held by a supplier: issued bags minus bags returned by them. */
export function supplierBagBalance(bagTransactions: BagTransaction[], supplierId: string): number {
  return bagTransactions.reduce((sum, b) => {
    if (b.isDeleted || b.supplierId !== supplierId) return sum;
    if (b.type === 'ISSUE') return sum + positive(b.quantity);
    if (b.type === 'RETURN') return sum - positive(b.quantity);
    return sum;
  }, 0);
}

// ---------------------------------------------------------------------------
// Payroll (Nigeria)
// ---------------------------------------------------------------------------

interface Band {
  limit: number;
  rate: number;
}

const PITA_2011_BANDS: Band[] = [
  { limit: 300_000, rate: 0.07 },
  { limit: 300_000, rate: 0.11 },
  { limit: 500_000, rate: 0.15 },
  { limit: 500_000, rate: 0.19 },
  { limit: 1_600_000, rate: 0.21 },
  { limit: Infinity, rate: 0.24 },
];

/** Nigeria Tax Act 2025, Fourth Schedule (effective 1 January 2026). */
const NTA_2025_BANDS: Band[] = [
  { limit: 800_000, rate: 0 },
  { limit: 2_200_000, rate: 0.15 },
  { limit: 9_000_000, rate: 0.18 },
  { limit: 13_000_000, rate: 0.21 },
  { limit: 25_000_000, rate: 0.23 },
  { limit: Infinity, rate: 0.25 },
];

export const NTA_2025_EFFECTIVE_MONTH = '2026-01';
export const RENT_RELIEF_RATE = 0.2;
export const RENT_RELIEF_CAP = 500_000;
export const EMPLOYEE_PENSION_RATE = 0.08;

export function taxRegimeForMonth(month: string): TaxRegime {
  return month >= NTA_2025_EFFECTIVE_MONTH ? 'NTA_2025' : 'PITA_2011';
}

function applyBands(taxable: number, bands: Band[]): number {
  let remaining = Math.max(0, taxable);
  let tax = 0;
  for (const band of bands) {
    if (remaining <= 0) break;
    const portion = Math.min(remaining, band.limit);
    tax += portion * band.rate;
    remaining -= portion;
  }
  return tax;
}

export interface PayrollInput {
  basicSalary: unknown;
  allowances?: unknown;
  applyPension?: boolean;
  applyPAYE?: boolean;
  annualRent?: unknown;
  otherDeductions?: unknown;
  month: string;
}

export interface PayrollFigures {
  basicSalary: number;
  allowances: number;
  grossIncome: number;
  pension: number;
  cra: number;
  rentRelief: number;
  taxableIncome: number;
  paye: number;
  otherDeductions: number;
  netPay: number;
  taxRegime: TaxRegime;
}

/**
 * Monthly payroll figures. Pension is the employee's 8% contribution on gross (simplified:
 * the app does not split housing/transport). PAYE follows PITA 2011 (with CRA and the 1%
 * minimum tax) for months before 2026-01 and the Nigeria Tax Act 2025 bands with rent
 * relief from 2026-01. Confirm treatment with a tax adviser before filing.
 */
export function computeMonthlyPayroll(input: PayrollInput): PayrollFigures {
  const basicSalary = round2(positive(input.basicSalary));
  const allowances = round2(positive(input.allowances));
  const grossIncome = round2(basicSalary + allowances);
  const pension = input.applyPension === false ? 0 : round2(grossIncome * EMPLOYEE_PENSION_RATE);
  const taxRegime = taxRegimeForMonth(input.month);

  const annualGross = grossIncome * 12;
  const annualPension = pension * 12;
  let annualTax = 0;
  let cra = 0;
  let rentRelief = 0;
  let annualTaxable = 0;

  if (taxRegime === 'PITA_2011') {
    const annualCra = Math.max(200_000, 0.01 * annualGross) + 0.2 * annualGross;
    cra = annualCra / 12;
    annualTaxable = Math.max(0, annualGross - annualCra - annualPension);
    const bandTax = applyBands(annualTaxable, PITA_2011_BANDS);
    annualTax = Math.max(bandTax, 0.01 * annualGross);
  } else {
    const annualRentRelief = Math.min(RENT_RELIEF_CAP, RENT_RELIEF_RATE * positive(input.annualRent));
    rentRelief = annualRentRelief / 12;
    annualTaxable = Math.max(0, annualGross - annualPension - annualRentRelief);
    annualTax = applyBands(annualTaxable, NTA_2025_BANDS);
  }

  const paye = input.applyPAYE === false || grossIncome === 0 ? 0 : round2(annualTax / 12);
  const otherDeductions = round2(positive(input.otherDeductions));
  const netPay = round2(grossIncome - pension - paye - otherDeductions);

  return {
    basicSalary,
    allowances,
    grossIncome,
    pension,
    cra: round2(cra),
    rentRelief: round2(rentRelief),
    taxableIncome: round2(annualTaxable / 12),
    paye,
    otherDeductions,
    netPay,
    taxRegime,
  };
}

// ---------------------------------------------------------------------------
// Profitability (estimate)
// ---------------------------------------------------------------------------

/** Journal outflows that are not operating expenses (financing, owner, capital or transfers). */
export const NON_OPERATING_OUTFLOW_CATEGORIES = new Set([
  'DRAWINGS',
  'ADVANCE PAYMENT',
  'ASSET PURCHASE',
  'LOAN REPAYMENT',
  'OUTSTANDING PAYMENT',
  'OUTSTANDING/ADVANCE',
  'PETTY CASH',
  'SUPPLIER CHARGEBACK',
  'SUPPLIER_CHARGE',
  'CUSTOMER_CHARGE',
]);

export const OPERATING_INCOME_CATEGORIES = new Set(['OTHER INCOME']);

export interface ProfitEstimate {
  revenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  otherIncome: number;
  operatingExpenses: number;
  netProfit: number;
  totalPurchases: number;
}

/**
 * Estimated profit for a period: sales revenue less weighted-average purchase cost of the
 * kilograms sold, plus other income, less operating expenses. Capital, loans, advances,
 * drawings and asset purchases are excluded because they are not profit or loss.
 */
export function estimateProfit(
  transactions: Transaction[],
  journal: JournalEntry[],
  range: { start?: string; end?: string } = {}
): ProfitEstimate {
  const inRange = (iso: string) => {
    const day = isoToLocalDate(iso);
    if (!day) return false;
    if (range.start && day < range.start) return false;
    if (range.end && day > range.end) return false;
    return true;
  };
  const upToEnd = (iso: string) => {
    const day = isoToLocalDate(iso);
    return !!day && (!range.end || day <= range.end);
  };

  const cost: Record<string, { value: number; kg: number }> = {};
  for (const t of transactions) {
    if (t.isDeleted || !upToEnd(t.date)) continue;
    const kg = positive(t.netWeight);
    const value = positive(t.totalValue);
    if (t.type === 'PURCHASE') {
      cost[t.commodity] = cost[t.commodity] || { value: 0, kg: 0 };
      cost[t.commodity].value += value;
      cost[t.commodity].kg += kg;
    } else if (t.type === 'PURCHASE_RETURN') {
      cost[t.commodity] = cost[t.commodity] || { value: 0, kg: 0 };
      cost[t.commodity].value -= value;
      cost[t.commodity].kg -= kg;
    }
  }
  const avgCost = (commodity: string) => {
    const c = cost[commodity];
    return c && c.kg > 0 ? Math.max(0, c.value) / c.kg : 0;
  };

  let revenue = 0;
  let cogs = 0;
  let totalPurchases = 0;
  for (const t of transactions) {
    if (t.isDeleted || !inRange(t.date)) continue;
    const kg = positive(t.netWeight);
    const value = positive(t.totalValue);
    if (t.type === 'SALE') {
      revenue += value;
      cogs += kg * avgCost(t.commodity);
    } else if (t.type === 'SALES_RETURN') {
      revenue -= value;
      cogs -= kg * avgCost(t.commodity);
    } else if (t.type === 'PURCHASE') {
      totalPurchases += value;
    }
  }

  let otherIncome = 0;
  let operatingExpenses = 0;
  for (const e of journal) {
    if (e.isDeleted || !inRange(e.date)) continue;
    const amount = positive(e.amount);
    if (e.type === 'INFLOW' && OPERATING_INCOME_CATEGORIES.has(e.category)) {
      otherIncome += amount;
    } else if (e.type === 'OUTFLOW' && !NON_OPERATING_OUTFLOW_CATEGORIES.has(e.category) && !e.supplierId && !e.buyerId) {
      operatingExpenses += amount;
    }
  }

  const grossProfit = revenue - cogs;
  return {
    revenue: round2(revenue),
    costOfGoodsSold: round2(cogs),
    grossProfit: round2(grossProfit),
    otherIncome: round2(otherIncome),
    operatingExpenses: round2(operatingExpenses),
    netProfit: round2(grossProfit + otherIncome - operatingExpenses),
    totalPurchases: round2(totalPurchases),
  };
}
