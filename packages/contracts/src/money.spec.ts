import { describe, expect, it } from 'vitest';
import { rateSchema, roundRupees, rupeesSchema, signedRupeesSchema } from './money.js';

describe('roundRupees', () => {
  it('rounds to paise without float errors', () => {
    expect(roundRupees(1.005)).toBe(1.01);
    expect(roundRupees(0.1 + 0.2)).toBe(0.3);
    expect(roundRupees(2.675)).toBe(2.68);
    expect(roundRupees(1.004)).toBe(1);
    expect(roundRupees(99999999.995)).toBe(100000000);
    expect(roundRupees(12.5)).toBe(12.5);
  });

  it('rounds half away from zero and flushes tiny values to 0', () => {
    expect(roundRupees(-1.005)).toBe(-1.01);
    expect(roundRupees(1e-7)).toBe(0);
    expect(Object.is(roundRupees(-1e-7), 0)).toBe(true);
  });

  it('rejects non-finite input', () => {
    expect(() => roundRupees(Number.NaN)).toThrow(RangeError);
    expect(() => roundRupees(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('money schemas', () => {
  it('rupeesSchema accepts at most two decimals and no negatives', () => {
    for (const ok of [0, 0.3, 10.25, 99999.99]) {
      expect(rupeesSchema.safeParse(ok).success, String(ok)).toBe(true);
    }
    for (const bad of [1.005, 0.123, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(rupeesSchema.safeParse(bad).success, String(bad)).toBe(false);
    }
  });

  it('rateSchema caps at 1,000,000', () => {
    expect(rateSchema.safeParse(1_000_000).success).toBe(true);
    expect(rateSchema.safeParse(1_000_000.01).success).toBe(false);
    expect(rateSchema.safeParse(2500.5).success).toBe(true);
  });

  it('signedRupeesSchema allows negatives with two decimals', () => {
    expect(signedRupeesSchema.safeParse(-5.25).success).toBe(true);
    expect(signedRupeesSchema.safeParse(-5.255).success).toBe(false);
  });
});
