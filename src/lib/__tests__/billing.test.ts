import { describe, expect, it } from 'vitest';
import {
  addMonths,
  canWriteWithSubscription,
  daysUntilExpiry,
  koboToNaira,
  nairaToKobo,
  nextExpiry,
  normalizeBillingConfig,
  paymentReference,
  subscriptionState,
} from '../billing';

describe('addMonths', () => {
  it('adds whole months', () => {
    expect(addMonths(new Date(2026, 0, 15), 1).toDateString()).toBe(new Date(2026, 1, 15).toDateString());
    expect(addMonths(new Date(2026, 0, 15), 12).toDateString()).toBe(new Date(2027, 0, 15).toDateString());
  });

  it('clamps the day when the target month is shorter', () => {
    expect(addMonths(new Date(2026, 0, 31), 1).toDateString()).toBe(new Date(2026, 1, 28).toDateString());
    // 2028 is a leap year.
    expect(addMonths(new Date(2028, 0, 31), 1).toDateString()).toBe(new Date(2028, 1, 29).toDateString());
    expect(addMonths(new Date(2026, 2, 31), 1).toDateString()).toBe(new Date(2026, 3, 30).toDateString());
  });
});

describe('nextExpiry', () => {
  const now = new Date(2026, 5, 10);

  it('starts from today for a first payment', () => {
    expect(nextExpiry(null, 1, now).toDateString()).toBe(new Date(2026, 6, 10).toDateString());
  });

  it('extends from the existing expiry when paying early, so no time is lost', () => {
    const current = new Date(2026, 6, 1);
    expect(nextExpiry(current, 1, now).toDateString()).toBe(new Date(2026, 7, 1).toDateString());
  });

  it('starts from today when the subscription already lapsed', () => {
    const lapsed = new Date(2026, 3, 1);
    expect(nextExpiry(lapsed, 2, now).toDateString()).toBe(new Date(2026, 7, 10).toDateString());
  });
});

describe('subscriptionState', () => {
  const now = new Date(2026, 5, 10, 12, 0, 0);

  it('treats a company without an expiry as unrestricted', () => {
    expect(subscriptionState(null, now)).toBe('UNLIMITED');
    expect(canWriteWithSubscription('UNLIMITED')).toBe(true);
  });

  it('is active before the expiry', () => {
    expect(subscriptionState(new Date(2026, 5, 11), now)).toBe('ACTIVE');
  });

  it('allows a grace period after the expiry', () => {
    const expired = new Date(2026, 5, 9, 12, 0, 0);
    expect(subscriptionState(expired, now, 3)).toBe('GRACE');
    expect(canWriteWithSubscription('GRACE')).toBe(true);
  });

  it('expires once the grace period passes', () => {
    const expired = new Date(2026, 5, 1);
    expect(subscriptionState(expired, now, 3)).toBe('EXPIRED');
    expect(canWriteWithSubscription('EXPIRED')).toBe(false);
  });

  it('expires immediately when there is no grace', () => {
    expect(subscriptionState(new Date(2026, 5, 9), now, 0)).toBe('EXPIRED');
  });
});

describe('daysUntilExpiry', () => {
  const now = new Date(2026, 5, 10);
  it('counts days ahead and behind', () => {
    expect(daysUntilExpiry(new Date(2026, 5, 15), now)).toBe(5);
    expect(daysUntilExpiry(new Date(2026, 5, 5), now)).toBe(-5);
    expect(daysUntilExpiry(null, now)).toBeNull();
  });
});

describe('money conversion', () => {
  it('converts between naira and kobo', () => {
    expect(nairaToKobo(2500)).toBe(250_000);
    expect(koboToNaira(250_000)).toBe(2500);
    expect(nairaToKobo(1999.99)).toBe(199_999);
    expect(nairaToKobo(NaN)).toBe(0);
  });
});

describe('normalizeBillingConfig', () => {
  it('fills in safe defaults for missing or invalid values', () => {
    const config = normalizeBillingConfig({ graceDays: -5, plans: { BASIC: { amountKobo: '5000', months: 99 } } });
    expect(config.currency).toBe('NGN');
    expect(config.graceDays).toBe(0);
    expect(config.plans.BASIC).toMatchObject({ amountKobo: 5000, months: 24 });
    expect(config.plans.STANDARD).toMatchObject({ amountKobo: 0, months: 1 });
  });

  it('never returns a negative price', () => {
    expect(normalizeBillingConfig({ plans: { BASIC: { amountKobo: -100, months: 1 } } }).plans.BASIC.amountKobo).toBe(0);
  });
});

describe('paymentReference', () => {
  it('is unique and safe for Paystack', () => {
    const a = paymentReference('comp_1775658964829');
    const b = paymentReference('comp_1775658964829');
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
