/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AppModuleInfo {
  id: string;
  name: string;
  category: 'Trade & Inventory' | 'Finance & Accounts' | 'Operations & Analytics';
  description: string;
}

export const ALL_SYSTEM_MODULES: AppModuleInfo[] = [
  { id: 'suppliers', name: 'Suppliers Directory', category: 'Trade & Inventory', description: 'Manage commodity suppliers & balances' },
  { id: 'buyers', name: 'Buyers Directory', category: 'Trade & Inventory', description: 'Manage buyers & customer accounts' },
  { id: 'inventory', name: 'Stock & Inventory', category: 'Trade & Inventory', description: 'Real-time commodity stock tracking & valuation' },
  { id: 'purchases', name: 'Commodity Purchases (Buy)', category: 'Trade & Inventory', description: 'Log inbound commodity purchases' },
  { id: 'sales', name: 'Commodity Sales', category: 'Trade & Inventory', description: 'Log outbound commodity sales & dispatches' },
  { id: 'store', name: 'Store Keeper Records', category: 'Operations & Analytics', description: 'Store intake/dispatch registers' },
  { id: 'warehouses', name: 'Stores & Warehouses', category: 'Operations & Analytics', description: 'Multi-warehouse location management' },
  { id: 'journal', name: 'Financial Journal', category: 'Finance & Accounts', description: 'Double-entry inflow/outflow ledger & balancing' },
  { id: 'petty_cash', name: 'Petty Cash System', category: 'Finance & Accounts', description: 'Imprest petty cash requests & approvals' },
  { id: 'staff', name: 'Staff Management & HR', category: 'Operations & Analytics', description: 'Staff directory, roles & permissions' },
  { id: 'analytics', name: 'Data & Analytics', category: 'Operations & Analytics', description: 'Profitability, charts & commodity insights' },
  { id: 'reports', name: 'Reports & Documents', category: 'Operations & Analytics', description: 'Waybills, receipts & operational exports' },
];

export const ALL_MODULE_IDS = ALL_SYSTEM_MODULES.map(m => m.id);

export type SubscriptionPlanType = 'BASIC' | 'STANDARD' | 'ENTERPRISE' | 'CUSTOM';

export const SUBSCRIPTION_PRESETS: Record<Exclude<SubscriptionPlanType, 'CUSTOM'>, { label: string; description: string; modules: string[] }> = {
  BASIC: {
    label: 'Basic Trade Tier',
    description: 'Essential commodity trading, supplier/buyer ledgers & stock tracking',
    modules: ['suppliers', 'buyers', 'inventory', 'purchases', 'sales']
  },
  STANDARD: {
    label: 'Standard Operations Tier',
    description: 'Trading + Store registers, warehouse management, petty cash & reports',
    modules: ['suppliers', 'buyers', 'inventory', 'purchases', 'sales', 'store', 'warehouses', 'petty_cash', 'reports']
  },
  ENTERPRISE: {
    label: 'Enterprise / Full Suite',
    description: 'Complete suite including double-entry Financial Journal, HR/Staffing & Analytics',
    modules: ALL_MODULE_IDS
  }
};
