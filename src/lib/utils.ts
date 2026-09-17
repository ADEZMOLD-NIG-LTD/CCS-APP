import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Rounds a number to a specified number of decimal places accurately.
 */
export function roundTo(value: number, decimals: number = 2): number {
  if (!Number.isFinite(value)) return 0;
  const multiplier = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON * Math.sign(value)) * multiplier) / multiplier;
}

/**
 * Parses user/database input into a finite number. Accepts numbers and numeric strings
 * with thousands separators ("1,234.50"). Anything else becomes 0.
 */
export function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '').trim();
    if (cleaned === '' || cleaned === '-' || cleaned === '.') return 0;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/**
 * Formats a number with comma separators and optional decimal precision.
 */
export function formatNumber(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(roundTo(toNumber(value), decimals));
}

/**
 * Weights are entered, calculated and stored to this many decimal places. Trade happens in
 * fractions of a kilogram, so rounding to 2 dp would silently turn 0.2222kg into 0.22kg on entry,
 * again in the net-weight calculation, and again in the stock ledger. Money stays at 2 dp.
 */
export const WEIGHT_DECIMALS = 5;

/** Rounds a weight, keeping the precision a scale actually produces. */
export const roundWeight = (value: number): number => roundTo(toNumber(value), WEIGHT_DECIMALS);

/** Shows a weight at whatever precision it has, up to WEIGHT_DECIMALS, with no padded zeros. */
export function formatWeight(value: number): string {
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: WEIGHT_DECIMALS,
  }).format(roundWeight(value));
}

/**
 * Formats a number as currency (Naira).
 */
export function formatCurrency(value: number): string {
  const n = toNumber(value);
  return `${n < 0 ? '-' : ''}₦${formatNumber(Math.abs(n), 2)}`;
}

/**
 * Returns the actual weight in KG. Since we now store all netWeights in KG, this handles casting.
 */
export function getWeightInKg(netWeight: unknown): number {
  return toNumber(netWeight);
}

/** Removes keys whose value is undefined (recursively for plain objects/arrays). Firestore rejects undefined. */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(v => stripUndefined(v)) as unknown as T;
  }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}

export function newId(): string {
  return crypto.randomUUID();
}

export function normalizeEmail(email: unknown): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}
