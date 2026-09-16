/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CompanyRole } from './lib/permissions';

export type { CompanyRole };

/** Server-set timestamps come back as Firestore Timestamps; legacy/demo data stores ISO strings. */
export type TimestampLike = string | { toDate: () => Date; toMillis: () => number } | null;

export interface SoftDeletable {
  isDeleted?: boolean;
  deletedBy?: string;
  deletedByUid?: string;
  deletionReason?: string;
  deletedAt?: string;
}

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DISMISSED';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  /** Legacy data may contain 'SUPER_ADMIN'; it grants nothing. Platform admins live in `platform_admins`. */
  role: CompanyRole | 'SUPER_ADMIN';
  companyId: string;
  assignedWarehouseId?: string | null;
  status?: UserStatus;
  /** Legacy boolean suspension flag, still honoured. */
  suspended?: boolean;
  createdAt: string;
  updatedAt?: string;
  lastPasswordUpdate?: string | null;
  mustChangePassword?: boolean;
  mustChangePasswordSetAt?: TimestampLike;
  inviteId?: string;
}

export type CompanyStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DELETED';

export interface Company extends SoftDeletable {
  id: string;
  name: string;
  ownerUid?: string;
  ownerEmail: string;
  createdAt: string;
  updatedAt?: string;
  /** Only a platform admin can set this to true. */
  isApproved?: boolean;
  status?: CompanyStatus;
  subscriptionPlan?: 'BASIC' | 'STANDARD' | 'ENTERPRISE' | 'CUSTOM';
  requestedPlan?: 'BASIC' | 'STANDARD' | 'ENTERPRISE';
  enabledModules?: string[];
  approvedAt?: string;
  approvedBy?: string;
  deletionRequestedAt?: string;
}

export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED';

export interface Invite {
  /** `${companyId}__${email}` */
  id: string;
  companyId: string;
  companyName: string;
  email: string;
  role: CompanyRole;
  staffId: string;
  assignedWarehouseId?: string | null;
  status: InviteStatus;
  invitedByUid: string;
  invitedByEmail: string;
  createdAt: string;
  acceptedAt?: string;
  acceptedByUid?: string;
}

export interface Supplier extends SoftDeletable {
  id: string;
  companyId: string;
  name: string;
  phone: string;
  location: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  previousBalance: number; // Positive for credit (we owe), negative for debit (they owe)
  createdAt: string;
  updatedAt?: string;
}

export type CommodityType = 'COCOA' | 'CASHEW' | 'PK' | string;
export type PackagingType = 'JUTE_BAG' | 'NYLON_BAG';
export type CalculationMethod = 'DIRECT' | 'MANUAL';

export interface Warehouse extends SoftDeletable {
  id: string;
  companyId: string;
  name: string;
  location: string;
  createdAt?: string;
}

export interface DeductionParams {
  moistureActual: number;
  moistureBenchmark: number;
  tareWeight: number;
  moldWeight: number;
  otherDeduction: number;
}

export interface Payment extends SoftDeletable {
  id: string;
  companyId: string;
  warehouseId: string;
  date: string;
  postingDate?: string;
  supplierId: string;
  amount: number;
  method: 'CASH' | 'BANK_TRANSFER' | 'CHECK';
  reference: string;
  description: string;
  createdByUid?: string;
}

export interface BagTransaction extends SoftDeletable {
  id: string;
  companyId: string;
  date: string;
  supplierId?: string;
  type: 'STOCK_IN' | 'ISSUE' | 'RETURN' | 'TRANSFER';
  packagingType: PackagingType;
  quantity: number;
  reference: string;
  warehouseId?: string;
  sourceWarehouseId?: string;
  destinationWarehouseId?: string;
  createdByUid?: string;
}

export type StaffStatus = 'ACTIVE' | 'SUSPENDED' | 'DISMISSED' | 'INACTIVE';

export interface Staff extends SoftDeletable {
  id: string;
  uid?: string;
  companyId: string;
  name: string;
  email?: string;
  role: CompanyRole;
  phone: string;
  salary: number;
  allowances?: number;
  joinedDate: string;
  status: StaffStatus;
  assignedWarehouseId?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  applyPAYE?: boolean;
  applyPension?: boolean;
  /** Annual rent paid by the employee; used for the NTA 2025 rent relief. */
  annualRent?: number;
  updatedAt?: string;
}

export interface Attendance {
  id: string;
  companyId: string;
  staffId: string;
  warehouseId: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE';
}

export interface Roster {
  id: string;
  companyId: string;
  staffId: string;
  warehouseId: string;
  shift: 'MORNING' | 'AFTERNOON' | 'NIGHT' | 'OFF';
  date: string;
}

export type TaxRegime = 'PITA_2011' | 'NTA_2025';

export interface Payroll {
  id: string;
  companyId: string;
  staffId: string;
  month: string; // YYYY-MM
  basicSalary: number;
  allowances: number;
  grossIncome: number;
  cra: number;
  rentRelief?: number;
  taxableIncome: number;
  paye: number;
  pension: number;
  otherDeductions: number;
  deductionsNote?: string;
  netPay: number;
  taxRegime?: TaxRegime;
  status: 'PENDING' | 'PAID';
  paidAt?: string;
  paidJournalId?: string;
  createdAt: string;
  updatedAt?: string;
}

export type JournalSource = 'MANUAL' | 'PETTY_CASH' | 'SUPPLIER' | 'BUYER' | 'PAYROLL';

export interface JournalEntry extends SoftDeletable {
  id: string;
  companyId: string;
  warehouseId: string;
  date: string;
  postingDate?: string;
  type: 'INFLOW' | 'OUTFLOW';
  category: string;
  amount: number;
  description: string;
  supplierId?: string;
  buyerId?: string;
  paymentMethod?: 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'CHECK' | 'OTHER' | string;
  reference?: string;
  bankName?: string;
  /** Legacy: hidden from the general journal list. See lib/finance isCashJournalEntry. */
  excludeFromJournal?: boolean;
  /** Explicit override: false means the entry does not move cash/bank balances. */
  cashEffect?: boolean;
  source?: JournalSource;
  createdByUid?: string;
}

export interface Buyer extends SoftDeletable {
  id: string;
  companyId: string;
  name: string;
  phone: string;
  location: string;
  previousBalance: number; // Positive for debit (they owe us), negative for credit (we owe them)
  createdAt: string;
  updatedAt?: string;
}

export type TransactionType = 'PURCHASE' | 'SALE' | 'TRANSFER' | 'PURCHASE_RETURN' | 'SALES_RETURN';

export interface Transaction extends SoftDeletable {
  id: string;
  companyId: string;
  date: string;
  postingDate?: string;
  type: TransactionType;
  commodity: CommodityType;
  supplierId?: string;
  buyerId?: string;
  buyerName?: string;
  sourceWarehouseId?: string;
  destinationWarehouseId?: string;
  warehouseId?: string;
  warehouse?: string;
  grossWeight: number;
  netWeight: number;
  bags: number;
  noOfBags?: number;
  pricePerKg?: number;
  totalValue?: number;
  calculationMethod?: CalculationMethod;
  deductions: DeductionParams;
  referenceId: string;
  storeRecordId?: string;
  isDirectDelivery?: boolean;
  /** Direct delivery: price per kg owed to the supplier. */
  supplierPricePerKg?: number;
  /** Direct delivery: amount credited to the supplier's ledger. */
  supplierCreditValue?: number;
  truckNo?: string;
  driverName?: string;
  driverPhone?: string;
  staffName?: string;
  notes?: string;
  createdByUid?: string;
  updatedAt?: string;
  updatedByUid?: string;
}

export interface StoreRecord extends SoftDeletable {
  id: string;
  companyId: string;
  date: string;
  type: 'IN' | 'OUT' | 'TRANSFER';
  customerName: string;
  location: string;
  nominalWeight: number;
  actualWeight: number;
  noOfBags: number;
  moisture: number;
  tare: number;
  fieldOfficer: string;
  truckNo: string;
  commodity: CommodityType;
  warehouseId: string;
  sourceWarehouseId?: string;
  destinationWarehouseId?: string;
  createdByUid?: string;
}

export interface AuditLog {
  id: string;
  companyId: string;
  timestamp: string;
  createdAt?: TimestampLike;
  userId: string;
  userEmail: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  module: string;
  recordId: string;
  details: string;
  previousData?: unknown;
  newData?: unknown;
}

export type AdjustmentTypeValue =
  | 'WEIGHT_LOSS'
  | 'DAMAGED_STOCK'
  | 'SPOILAGE'
  | 'THEFT_LOSS'
  | 'STOCK_COUNT'
  | 'QUALITY_TEST'
  | 'INTERNAL_USE';

export interface InventoryAdjustment extends SoftDeletable {
  id: string;
  companyId: string;
  date: string;
  postingDate: string;
  commodity: CommodityType;
  warehouseId: string;
  adjustmentType: AdjustmentTypeValue;
  adjustmentDirection: 'ADD' | 'REMOVE';
  netWeight: number;
  bags: number;
  notes?: string;
  createdBy: string;
  creatorEmail: string;
}

export interface PettyCashTransaction extends SoftDeletable {
  id: string;
  companyId: string;
  warehouseId: string;
  date: string;
  postingDate: string;
  type: 'DISBURSEMENT' | 'EXPENSE';
  amount: number;
  category: string;
  description: string;
  recipient: string;
  status: 'PENDING' | 'RETIRED';
  retiredDate?: string;
  retiredJournalId?: string;
  reference?: string;
  createdBy: string;
  creatorEmail: string;
}

export const GLOBAL_NOTIFICATION_COMPANY_ID = '__ALL__';

export interface SystemNotification {
  id: string;
  /** A company id, or GLOBAL_NOTIFICATION_COMPANY_ID for platform-wide announcements. */
  companyId: string;
  title: string;
  message: string;
  type: 'info' | 'alert' | 'update';
  createdAt: string;
  createdBy: string;
  creatorName: string;
  targetRole?: string;
}

export type StockLedger = 'COMMODITY' | 'BAG' | 'STORE' | 'PETTY_CASH';

export interface StockBalance {
  id: string;
  companyId: string;
  ledger: StockLedger;
  warehouseId: string;
  item: string;
  quantity: number;
  updatedAt?: TimestampLike;
}
