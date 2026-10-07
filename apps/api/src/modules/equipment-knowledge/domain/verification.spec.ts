import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DomainError } from '../../../platform/http';
import type { SpecificationValue } from './entities';
import {
  resolveLinkVerification,
  resolveVerification,
  type VerificationInput,
} from './verification';

const empty: SpecificationValue = {
  numericValue: null,
  minValue: null,
  maxValue: null,
  unit: null,
  textValue: null,
  normalizedMin: null,
  normalizedMax: null,
};
const filled: SpecificationValue = { ...empty, textValue: 'Diesel' };
const manufacturer = { id: 'src-m', sourceType: 'MANUFACTURER' } as const;
const fixture = { id: 'src-f', sourceType: 'TEST_FIXTURE' } as const;
const now = new Date('2026-10-07T12:00:00.000Z');
const earlier = new Date('2026-01-01T00:00:00.000Z');

function resolve(input: Partial<VerificationInput>) {
  return resolveVerification({
    value: filled,
    requested: undefined,
    source: null,
    current: null,
    valueChanged: true,
    now,
    ...input,
  });
}

function rejects(input: Partial<VerificationInput>, code: string) {
  assert.throws(
    () => resolve(input),
    (e: unknown) => e instanceof DomainError && e.code === code && e.status === 400,
  );
}

describe('resolveVerification', () => {
  it('defaults a new value to REVIEW_REQUIRED and an empty one to UNKNOWN', () => {
    assert.deepEqual(resolve({}), {
      verificationStatus: 'REVIEW_REQUIRED',
      sourceId: null,
      verifiedAt: null,
    });
    assert.equal(resolve({ value: empty }).verificationStatus, 'UNKNOWN');
  });

  it('verifies a value with a non-fixture source and stamps verifiedAt', () => {
    assert.deepEqual(resolve({ requested: 'VERIFIED', source: manufacturer }), {
      verificationStatus: 'VERIFIED',
      sourceId: 'src-m',
      verifiedAt: now,
    });
  });

  it('allows a TEST_FIXTURE source on non-verified values', () => {
    assert.equal(resolve({ source: fixture }).sourceId, 'src-f');
    assert.equal(
      resolve({ requested: 'DEPRECATED', source: fixture }).verificationStatus,
      'DEPRECATED',
    );
  });

  it('rejects an empty value with any status other than UNKNOWN', () => {
    for (const requested of ['VERIFIED', 'REVIEW_REQUIRED', 'DEPRECATED'] as const) {
      rejects({ value: empty, requested, source: manufacturer }, 'invalid_verification_status');
    }
  });

  it('rejects UNKNOWN for a value that is set', () => {
    rejects({ requested: 'UNKNOWN' }, 'invalid_verification_status');
  });

  it('rejects VERIFIED without a source', () => {
    rejects({ requested: 'VERIFIED' }, 'verification_source_required');
  });

  it('rejects VERIFIED from a TEST_FIXTURE source', () => {
    rejects({ requested: 'VERIFIED', source: fixture }, 'test_fixture_not_verifiable');
  });

  describe('on update', () => {
    const verified = { verificationStatus: 'VERIFIED', verifiedAt: earlier } as const;

    it('keeps status and verifiedAt when neither the value nor the status changes', () => {
      assert.deepEqual(resolve({ current: verified, valueChanged: false, source: manufacturer }), {
        verificationStatus: 'VERIFIED',
        sourceId: 'src-m',
        verifiedAt: earlier,
      });
    });

    it('re-validates a kept VERIFIED status against a new source', () => {
      rejects(
        { current: verified, valueChanged: false, source: null },
        'verification_source_required',
      );
      rejects(
        { current: verified, valueChanged: false, source: fixture },
        'test_fixture_not_verifiable',
      );
    });

    it('drops back to REVIEW_REQUIRED when the value changes', () => {
      assert.deepEqual(resolve({ current: verified, source: manufacturer }), {
        verificationStatus: 'REVIEW_REQUIRED',
        sourceId: 'src-m',
        verifiedAt: null,
      });
    });

    it('becomes UNKNOWN when the value is cleared', () => {
      assert.equal(
        resolve({ value: empty, current: verified, source: manufacturer }).verificationStatus,
        'UNKNOWN',
      );
    });

    it('refreshes verifiedAt when VERIFIED is sent again', () => {
      const result = resolve({
        current: verified,
        valueChanged: false,
        requested: 'VERIFIED',
        source: manufacturer,
      });
      assert.equal(result.verifiedAt, now);
    });

    it('clears verifiedAt when leaving VERIFIED', () => {
      const result = resolve({
        current: verified,
        valueChanged: false,
        requested: 'DEPRECATED',
        source: manufacturer,
      });
      assert.deepEqual(result, {
        verificationStatus: 'DEPRECATED',
        sourceId: 'src-m',
        verifiedAt: null,
      });
    });
  });
});

describe('resolveLinkVerification', () => {
  it('defaults to REVIEW_REQUIRED and keeps an optional source', () => {
    assert.deepEqual(resolveLinkVerification({ requested: undefined, source: null, now }), {
      verificationStatus: 'REVIEW_REQUIRED',
      sourceId: null,
      verifiedAt: null,
    });
    assert.deepEqual(resolveLinkVerification({ requested: undefined, source: fixture, now }), {
      verificationStatus: 'REVIEW_REQUIRED',
      sourceId: 'src-f',
      verifiedAt: null,
    });
  });

  it('stamps verifiedAt when VERIFIED from a real source', () => {
    assert.deepEqual(
      resolveLinkVerification({ requested: 'VERIFIED', source: manufacturer, now }),
      { verificationStatus: 'VERIFIED', sourceId: 'src-m', verifiedAt: now },
    );
  });

  it('rejects VERIFIED without a source or from a TEST_FIXTURE', () => {
    const rejects = (source: typeof manufacturer | typeof fixture | null, code: string) =>
      assert.throws(
        () => resolveLinkVerification({ requested: 'VERIFIED', source, now }),
        (e: unknown) => e instanceof DomainError && e.code === code && e.status === 400,
      );
    rejects(null, 'verification_source_required');
    rejects(fixture, 'test_fixture_not_verifiable');
  });
});
