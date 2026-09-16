import { describe, expect, it } from 'vitest';
import { buildCsv, escapeCsvValue } from '../csv';
import { canAssignRole, roleCan } from '../permissions';
import { isoToLocalDate, localDateToIso, toLocalMonthString } from '../dates';
import { formatCurrency, roundTo, stripUndefined, toNumber } from '../utils';

describe('permissions', () => {
  it('keeps auditors read-only', () => {
    expect(roleCan('AUDITOR', 'view_trade')).toBe(true);
    expect(roleCan('AUDITOR', 'view_reports')).toBe(true);
    expect(roleCan('AUDITOR', 'create_trade')).toBe(false);
    expect(roleCan('AUDITOR', 'post_journal')).toBe(false);
    expect(roleCan('AUDITOR', 'record_petty_expense')).toBe(false);
    expect(roleCan('AUDITOR', 'manage_payroll')).toBe(false);
  });

  it('restricts destructive actions', () => {
    expect(roleCan('STAFF', 'delete_parties')).toBe(false);
    expect(roleCan('STAFF', 'edit_trade')).toBe(false);
    expect(roleCan('STAFF', 'fund_petty_cash')).toBe(false);
    expect(roleCan('MANAGER', 'delete_trade')).toBe(false);
    expect(roleCan('ADMIN', 'delete_trade')).toBe(true);
    expect(roleCan('ACCOUNT', 'manage_payroll')).toBe(true);
  });

  it('rejects unknown and legacy roles', () => {
    expect(roleCan('SUPER_ADMIN', 'view_trade')).toBe(false);
    expect(roleCan(undefined, 'view_trade')).toBe(false);
    expect(roleCan('GUEST', 'view_trade')).toBe(false);
  });

  it('prevents managers from creating admins', () => {
    expect(canAssignRole('MANAGER', 'ADMIN')).toBe(false);
    expect(canAssignRole('MANAGER', 'ACCOUNT')).toBe(true);
    expect(canAssignRole('ADMIN', 'ADMIN')).toBe(true);
    expect(canAssignRole('STAFF', 'STAFF')).toBe(false);
  });
});

describe('csv', () => {
  it('quotes separators and neutralises formulas', () => {
    expect(escapeCsvValue('Doe, John')).toBe('"Doe, John"');
    expect(escapeCsvValue('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvValue('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(escapeCsvValue('+2348000')).toBe(`'+2348000`);
    expect(escapeCsvValue(-500)).toBe('-500');
    expect(escapeCsvValue(null)).toBe('');
    expect(buildCsv(['a', 'b'], [[1, 'x']])).toBe('a,b\r\n1,x');
  });
});

describe('dates', () => {
  it('round-trips a picked local date', () => {
    expect(isoToLocalDate(localDateToIso('2026-01-31'))).toBe('2026-01-31');
    expect(isoToLocalDate(localDateToIso('2025-12-01'))).toBe('2025-12-01');
  });

  it('uses the fallback for invalid input', () => {
    expect(localDateToIso('not-a-date', 'X')).toBe('X');
    expect(isoToLocalDate('garbage')).toBe('');
  });

  it('formats local months', () => {
    expect(toLocalMonthString(new Date(2026, 0, 31, 23, 59))).toBe('2026-01');
  });
});

describe('utils', () => {
  it('parses numbers safely', () => {
    expect(toNumber('1,234.50')).toBe(1234.5);
    expect(toNumber('')).toBe(0);
    expect(toNumber('abc')).toBe(0);
    expect(toNumber(NaN)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
  });

  it('rounds and formats currency', () => {
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(roundTo(-1.005, 2)).toBe(-1.01);
    expect(formatCurrency(-1500)).toBe('-₦1,500');
  });

  it('strips undefined values deeply', () => {
    expect(stripUndefined({ a: 1, b: undefined, c: { d: undefined, e: 2 } })).toEqual({ a: 1, c: { e: 2 } });
  });
});
