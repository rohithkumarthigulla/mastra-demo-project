import type {
  SpecificationSource,
  SpecificationValue,
  SpecificationVerification,
  VerificationStatus,
} from './entities';
import {
  InvalidVerificationStatusError,
  TestFixtureNotVerifiableError,
  VerificationSourceRequiredError,
} from './errors';

export interface VerificationInput {
  /** The already-resolved value the status applies to. */
  value: SpecificationValue;
  /** Status sent by the caller; omitted means "use the default". */
  requested: VerificationStatus | undefined;
  source: Pick<SpecificationSource, 'id' | 'sourceType'> | null;
  /** Current state when updating; null when creating. */
  current: Pick<SpecificationVerification, 'verificationStatus' | 'verifiedAt'> | null;
  /** Whether the value was (re)written; a changed value is no longer verified by default. */
  valueChanged: boolean;
  now: Date;
}

export function hasSpecificationValue(value: SpecificationValue): boolean {
  return (
    value.numericValue !== null ||
    value.minValue !== null ||
    value.maxValue !== null ||
    value.textValue !== null
  );
}

/**
 * Decides the verification status and timestamp for a specification value.
 * Rules: an empty value is UNKNOWN and only an empty value is UNKNOWN; VERIFIED needs a
 * source that is not a TEST_FIXTURE; verifiedAt is set only while VERIFIED.
 */
export function resolveVerification(input: VerificationInput): SpecificationVerification {
  const { value, requested, source, current, valueChanged, now } = input;
  const hasValue = hasSpecificationValue(value);

  let status: VerificationStatus;
  if (requested !== undefined) status = requested;
  else if (current && !valueChanged) status = current.verificationStatus;
  else status = hasValue ? 'REVIEW_REQUIRED' : 'UNKNOWN';

  if (!hasValue && status !== 'UNKNOWN') {
    throw new InvalidVerificationStatusError(`A specification without a value cannot be ${status}`);
  }
  if (hasValue && status === 'UNKNOWN') {
    throw new InvalidVerificationStatusError('A specification with a value cannot be UNKNOWN');
  }

  let verifiedAt: Date | null = null;
  if (status === 'VERIFIED') {
    if (!source) throw new VerificationSourceRequiredError();
    if (source.sourceType === 'TEST_FIXTURE') throw new TestFixtureNotVerifiableError();
    const keep = requested === undefined && current?.verificationStatus === 'VERIFIED';
    verifiedAt = keep ? current.verifiedAt : now;
  }

  return { verificationStatus: status, sourceId: source?.id ?? null, verifiedAt };
}
