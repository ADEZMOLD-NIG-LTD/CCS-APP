import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Rounds a number to a specified number of decimal places accurately.
 */
export function roundTo(value: number, decimals: number = 2): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

/**
 * Formats a number with comma separators and optional decimal precision.
 */
export function formatNumber(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(roundTo(value, decimals));
}

/**
 * Formats a number as currency (Naira).
 */
export function formatCurrency(value: number): string {
  return `₦${formatNumber(value, 2)}`;
}

/**
 * Returns the actual weight in KG. Since we now store all netWeights in KG, this handles casting.
 */
export function getWeightInKg(netWeight: any): number {
  return Number(netWeight) || 0;
}
