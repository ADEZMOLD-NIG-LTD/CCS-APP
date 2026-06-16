/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'ADMIN' | 'MANAGER' | 'ACCOUNT' | 'STAFF' | 'AUDITOR' | 'STORE_KEEPER';
  companyId: string;
  assignedWarehouseId?: string; // For staff assigned to specific warehouse
  createdAt: string;
  lastPasswordUpdate?: string; // ISO string for password expiration tracking
  suspended?: boolean;
}

export interface Company {
  id: string;
  name: string;
  ownerEmail: string;
  createdAt: string;
  isApproved?: boolean; // Super admin must approve new companies
}

export interface Supplier {
  id: string;
  companyId: string;
  name: string;
  phone: string;
  location: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  previousBalance: number; // Positive for credit, negative for debit
  createdAt: string;
  isDeleted?: boolean;
  deletedBy?: string;
  deletionReason?: string;
  deletedAt?: string;
}

export type CommodityType = 'COCOA' | 'CASHEW' | 'PK';
export type PackagingType = 'JUTE_BAG' | 'NYLON_BAG';
export type CalculationMethod = 'DIRECT' | 'MANUAL';

export interface Warehouse {
  id: string;
  companyId: string;
  name: string;
  location: string;
}

export interface InventoryItem {
  companyId: string;
  commodity: CommodityType;
  warehouseId: string;
  quantity: number; // Net weight in kg
  bags: number;
}

export interface DeductionParams {
  moistureActual: number;
  moistureBenchmark: number;
  tareWeight: number; // Manual deduction for bags
  moldWeight: number; // Manual deduction for quality
  otherDeduction: number;
}

export interface Payment {
  id: string;
  companyId: string;
  warehouseId: string;
  date: string; // The selected transaction date
  postingDate?: string; // The actual software entry/posting timestamp
  supplierId: string;
  amount: number;
  method: 'CASH' | 'BANK_TRANSFER' | 'CHECK';
  reference: string;
  description: string;
  isDeleted?: boolean;
  deletedBy?: string;
  deletionReason?: string;
  deletedAt?: string;
}

export interface BagTransaction {
  id: string;
  companyId: string;
  date: string;
  supplierId?: string; // Optional: if issued to a specific supplier
  type: 'STOCK_IN' | 'ISSUE' | 'RETURN' | 'TRANSFER';
  packagingType: PackagingType;
  quantity: number;
  reference: string;
  warehouseId?: string; // For STOCK_IN, ISSUE, RETURN
  sourceWarehouseId?: string; // For TRANSFER
  destinationWarehouseId?: string; // For TRANSFER
  isDeleted?: boolean;
  deletedBy?: string;
  deletionReason?: string;
  deletedAt?: string;
}

export interface PackagingInventory {
  companyId: string;
  packagingType: PackagingType;
  warehouseId: string;
  quantity: number;
}

export interface Staff {
  id: string;
  uid?: string; // Add this to track if they've joined
  companyId: string;
  name: string;
  email?: string;
  role: 'ADMIN' | 'MANAGER' | 'ACCOUNT' | 'STAFF' | 'AUDITOR' | 'STORE_KEEPER';
  phone: string;
  salary: number; // Basic Salary
  allowances?: number;
  joinedDate: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'DISMISSED' | 'INACTIVE';
  assignedWarehouseId?: string;
  bankName?: string;
  accountNumber?: string;
}

export interface Attendance {
  id: string;
  companyId: string;
  staffId: string;
  warehouseId: string; // Added for filtering
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

export interface Payroll {
  id: string;
  companyId: string;
  staffId: string;
  month: string; // YYYY-MM
  basicSalary: number;
  allowances: number;
  grossIncome: number;
  cra: number; // Consolidated Relief Allowance
  taxableIncome: number;
  paye: number;
  pension: number; // Usually 8% of (Basic + Housing + Transport)
  netPay: number;
  status: 'PENDING' | 'PAID';
  createdAt: string;
}

export interface JournalEntry {
  id: string;
  companyId: string;
  warehouseId: string;
  date: string; // The selected transaction date
  postingDate?: string; // The actual software entry/posting timestamp
  type: 'INFLOW' | 'OUTFLOW';
  category: string;
  amount: number;
  description: string;
  supplierId?: string; // Optional: if charged to a supplier (for outflows)
  buyerId?: string; // Optional: if received from a buyer (for inflows)
  paymentMethod: 'CASH' | 'BANK_TRANSFER';
  bankName?: string;
  isDeleted?: boolean;
  deletedBy?: string;
  deletionReason?: string;
  deletedAt?: string;
  excludeFromJournal?: boolean;
}

export interface Buyer {
  id: string;
  companyId: string;
  name: string;
  phone: string;
  location: string;
  previousBalance: number; // Positive for debit (they owe us), negative for credit (we owe them)
  createdAt: string;
  isDeleted?: boolean;
  deletedBy?: string;
  deletionReason?: string;
  deletedAt?: string;
}

export interface Transaction {
  id: string;
  companyId: string;
  date: string; // The selected transaction date
  postingDate?: string; // The actual software entry/posting timestamp
  type: 'PURCHASE' | 'SALE' | 'TRANSFER' | 'PURCHASE_RETURN' | 'SALES_RETURN';
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
  truckNo?: string;
  driverName?: string;
  driverPhone?: string;
  staffName?: string;
  notes?: string;
  isDeleted?: boolean;
  deletedBy?: string;
  deletionReason?: string;
  deletedAt?: string;
}

export interface StoreRecord {
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
  warehouseId: string; // For IN/OUT
  sourceWarehouseId?: string; // For TRANSFER
  destinationWarehouseId?: string; // For TRANSFER
  isDeleted?: boolean;
  deletedBy?: string;
  deletionReason?: string;
  deletedAt?: string;
}

export interface AuditLog {
  id: string;
  companyId: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  module: string;
  recordId: string;
  details: string;
  previousData?: any;
  newData?: any;
}

export type AdjustmentTypeValue =
  | 'WEIGHT_LOSS'
  | 'DAMAGED_STOCK'
  | 'SPOILAGE'
  | 'THEFT_LOSS'
  | 'STOCK_COUNT'
  | 'QUALITY_TEST'
  | 'INTERNAL_USE';

export interface InventoryAdjustment {
  id: string;
  companyId: string;
  date: string; // ISO string for the selected day of the adjustment
  postingDate: string; // ISO string when logged in the database
  commodity: CommodityType;
  warehouseId: string;
  adjustmentType: AdjustmentTypeValue;
  adjustmentDirection: 'ADD' | 'REMOVE';
  netWeight: number; // weight in kg
  bags: number; // bags affected
  notes?: string;
  createdBy: string;
  creatorEmail: string;
  isDeleted?: boolean;
  deletedBy?: string;
  deletionReason?: string;
  deletedAt?: string;
}

export interface PettyCashTransaction {
  id: string;
  companyId: string;
  warehouseId: string;
  date: string; // transaction selection date
  postingDate: string; // ISO string
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
  isDeleted?: boolean;
  deletedBy?: string;
  deletionReason?: string;
  deletedAt?: string;
}

