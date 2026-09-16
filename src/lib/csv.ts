/**
 * CSV helpers that are safe to open in Excel/Sheets:
 *  - values are quoted when they contain separators, quotes or newlines (RFC 4180)
 *  - values starting with = + - @ tab or CR are prefixed with a single quote so spreadsheet
 *    apps treat them as text instead of formulas (CSV/formula injection)
 */

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = typeof value === 'number' ? (Number.isFinite(value) ? String(value) : '') : String(value);
  if (typeof value !== 'number' && FORMULA_PREFIX.test(text)) {
    text = `'${text}`;
  }
  if (/[",\n\r]/.test(text)) {
    text = `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map(row => row.map(escapeCsvValue).join(',')).join('\r\n');
}

export function downloadCsv(filename: string, headers: string[], rows: unknown[][]): void {
  // Prepend BOM so Excel detects UTF-8 (₦ and names with accents render correctly).
  const blob = new Blob(['﻿' + buildCsv(headers, rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.replace(/[^\w.\-]+/g, '_');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
