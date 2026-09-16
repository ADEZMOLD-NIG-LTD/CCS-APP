/**
 * Subscription billing (Paystack, manual renewal).
 *
 * A company pays for a number of months up front. The payment extends
 * `companies/{id}.subscriptionExpiresAt`, which only the API server writes. When that date
 * passes, the security rules stop accepting writes but still allow reads, so a company that
 * has not renewed keeps full access to its own history and can pay to resume.
 *
 * Prices live in `platform_config/billing` so a platform admin can change them without a deploy.
 * Amounts are held in kobo (1 naira = 100 kobo) because that is what Paystack charges in.
 */

import type { BillingPlanId } from '../types';

export const BILLING_CONFIG_PATH = { collection: 'platform_config', id: 'billing' } as const;
export const BILLING_PLAN_IDS: BillingPlanId[] = ['BASIC', 'STANDARD', 'ENTERPRISE'];

export interface BillingPlanPrice {
  /** Price for one billing period, in kobo. 0 means "not for sale yet". */
  amountKobo: number;
  /** Months granted per payment. */
  months: number;
  label?: string;
}

export interface BillingConfig {
  currency: 'NGN';
  /** Days a company keeps writing after the expiry date, for payments in flight. */
  graceDays: number;
  plans: Record<BillingPlanId, BillingPlanPrice>;
  updatedAt?: string;
  updatedBy?: string;
}

/** Until a platform admin sets prices, nothing is on sale and no company is restricted. */
export const DEFAULT_BILLING_CONFIG: BillingConfig = {
  currency: 'NGN',
  graceDays: 3,
  plans: {
    BASIC: { amountKobo: 0, months: 1 },
    STANDARD: { amountKobo: 0, months: 1 },
    ENTERPRISE: { amountKobo: 0, months: 1 },
  },
};

export function normalizeBillingConfig(raw: unknown): BillingConfig {
  const input = (raw ?? {}) as Partial<BillingConfig>;
  const plans = {} as Record<BillingPlanId, BillingPlanPrice>;
  for (const id of BILLING_PLAN_IDS) {
    const plan = input.plans?.[id];
    plans[id] = {
      amountKobo: Math.max(0, Math.round(Number(plan?.amountKobo) || 0)),
      months: Math.min(24, Math.max(1, Math.round(Number(plan?.months) || 1))),
      label: typeof plan?.label === 'string' ? plan.label : undefined,
    };
  }
  return {
    currency: 'NGN',
    graceDays: Math.min(30, Math.max(0, Math.round(Number(input.graceDays ?? DEFAULT_BILLING_CONFIG.graceDays)))),
    plans,
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : undefined,
    updatedBy: typeof input.updatedBy === 'string' ? input.updatedBy : undefined,
  };
}

export const koboToNaira = (kobo: number): number => Math.round(Number(kobo) || 0) / 100;
export const nairaToKobo = (naira: number): number => Math.round((Number(naira) || 0) * 100);

/**
 * Adds whole months, clamping the day when the target month is shorter:
 * 31 January + 1 month = 28 February (29 in a leap year).
 */
export function addMonths(from: Date, months: number): Date {
  const day = from.getDate();
  const result = new Date(from.getTime());
  result.setDate(1);
  result.setMonth(result.getMonth() + Math.round(months));
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

/**
 * New expiry after a payment. Paying early extends from the existing expiry so no time is lost;
 * paying after a lapse starts from today.
 */
export function nextExpiry(currentExpiry: Date | null | undefined, months: number, now: Date = new Date()): Date {
  const base = currentExpiry && currentExpiry.getTime() > now.getTime() ? currentExpiry : now;
  return addMonths(base, months);
}

export type SubscriptionState = 'UNLIMITED' | 'ACTIVE' | 'GRACE' | 'EXPIRED';

/** A company with no expiry date is unrestricted: existing customers are untouched until sold a plan. */
export function subscriptionState(expiresAt: Date | null | undefined, now: Date = new Date(), graceDays = 0): SubscriptionState {
  if (!expiresAt) return 'UNLIMITED';
  if (expiresAt.getTime() > now.getTime()) return 'ACTIVE';
  const graceEnds = expiresAt.getTime() + Math.max(0, graceDays) * 86_400_000;
  return now.getTime() <= graceEnds ? 'GRACE' : 'EXPIRED';
}

/** Whole days until expiry; negative once it has passed. */
export function daysUntilExpiry(expiresAt: Date | null | undefined, now: Date = new Date()): number | null {
  if (!expiresAt) return null;
  return Math.ceil((expiresAt.getTime() - now.getTime()) / 86_400_000);
}

export const canWriteWithSubscription = (state: SubscriptionState): boolean => state !== 'EXPIRED';

/** Payment reference sent to Paystack. Readable in their dashboard and unique per attempt. */
export function paymentReference(companyId: string, now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const salt = Math.random().toString(36).slice(2, 8);
  return `ccs_${companyId.slice(0, 20)}_${stamp}_${salt}`.replace(/[^A-Za-z0-9_-]/g, '');
}
