/**
 * Single source of truth for company-level role permissions.
 *
 * IMPORTANT: firestore.rules enforces the same matrix server-side. Any change here
 * must be mirrored in the role lists at the top of firestore.rules (and covered by
 * tests/rules). The UI uses this module only to decide what to show; the rules are
 * the actual security boundary.
 */

export type CompanyRole = 'ADMIN' | 'MANAGER' | 'ACCOUNT' | 'AUDITOR' | 'STORE_KEEPER' | 'STAFF';

export const COMPANY_ROLES: CompanyRole[] = ['ADMIN', 'MANAGER', 'ACCOUNT', 'AUDITOR', 'STORE_KEEPER', 'STAFF'];

export const ROLE_LABELS: Record<CompanyRole, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  ACCOUNT: 'Account / Finance',
  AUDITOR: 'Auditor (read-only)',
  STORE_KEEPER: 'Store Keeper',
  STAFF: 'Staff',
};

const ALL: CompanyRole[] = [...COMPANY_ROLES];
const OPS: CompanyRole[] = ['ADMIN', 'MANAGER', 'ACCOUNT', 'STAFF'];
const OPS_STORE: CompanyRole[] = ['ADMIN', 'MANAGER', 'ACCOUNT', 'STAFF', 'STORE_KEEPER'];
const FIN: CompanyRole[] = ['ADMIN', 'MANAGER', 'ACCOUNT'];
const MGMT: CompanyRole[] = ['ADMIN', 'MANAGER'];
const ADMIN_ONLY: CompanyRole[] = ['ADMIN'];
const OVERSIGHT: CompanyRole[] = ['ADMIN', 'MANAGER', 'ACCOUNT', 'AUDITOR'];

export const PERMISSION_MATRIX = {
  view_trade: ALL,
  create_trade: OPS,
  edit_trade: FIN,
  delete_trade: ADMIN_ONLY,
  manage_parties: OPS,
  delete_parties: MGMT,
  transfer_stock: MGMT,
  adjust_inventory: MGMT,
  delete_inventory_adjustment: ADMIN_ONLY,
  record_bags: OPS_STORE,
  record_supplier_payment: FIN,
  adjust_ledger_entries: ADMIN_ONLY,
  view_journal: OVERSIGHT,
  /** Cash entries against a customer or supplier account (receipts, charges). Finance only. */
  post_journal: FIN,
  post_general_journal: FIN,
  edit_journal: FIN,
  delete_journal: FIN,
  view_petty_cash: ALL,
  record_petty_expense: OPS_STORE,
  fund_petty_cash: FIN,
  view_store_records: ['ADMIN', 'MANAGER', 'STORE_KEEPER', 'AUDITOR'] as CompanyRole[],
  manage_store_records: ['ADMIN', 'MANAGER', 'STORE_KEEPER'] as CompanyRole[],
  delete_store_records: MGMT,
  manage_warehouses: MGMT,
  delete_warehouses: ADMIN_ONLY,
  view_staff: OVERSIGHT,
  manage_staff: MGMT,
  manage_attendance: FIN,
  view_payroll: OVERSIGHT,
  manage_payroll: FIN,
  view_reports: OVERSIGHT,
  view_analytics: OVERSIGHT,
  view_audit_logs: ['ADMIN', 'MANAGER', 'AUDITOR'] as CompanyRole[],
  manage_company: ADMIN_ONLY,
  broadcast_company: MGMT,
} satisfies Record<string, CompanyRole[]>;

export type PermissionAction = keyof typeof PERMISSION_MATRIX;

export function isCompanyRole(value: unknown): value is CompanyRole {
  return typeof value === 'string' && (COMPANY_ROLES as string[]).includes(value);
}

export function roleCan(role: string | null | undefined, action: PermissionAction): boolean {
  if (!isCompanyRole(role)) return false;
  return PERMISSION_MATRIX[action].includes(role);
}

/** Managers may manage everyone except Admins; Admins may assign any role. */
export function canAssignRole(actorRole: string | null | undefined, targetRole: string | null | undefined): boolean {
  if (!isCompanyRole(targetRole)) return false;
  if (actorRole === 'ADMIN') return true;
  if (actorRole === 'MANAGER') return targetRole !== 'ADMIN';
  return false;
}

export type AppModuleKey =
  | 'dashboard' | 'suppliers' | 'buyers' | 'inventory' | 'purchases' | 'sales' | 'store'
  | 'warehouses' | 'journal' | 'petty_cash' | 'staff' | 'analytics' | 'reports';

/** Which permission a user needs to open each module (in addition to the company having it enabled). */
export const MODULE_VIEW_PERMISSION: Record<Exclude<AppModuleKey, 'dashboard'>, PermissionAction> = {
  suppliers: 'view_trade',
  buyers: 'view_trade',
  inventory: 'view_trade',
  purchases: 'view_trade',
  sales: 'view_trade',
  store: 'view_store_records',
  warehouses: 'manage_warehouses',
  journal: 'view_journal',
  petty_cash: 'view_petty_cash',
  staff: 'view_staff',
  analytics: 'view_analytics',
  reports: 'view_reports',
};
