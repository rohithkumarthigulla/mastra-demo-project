import {
  createBlockRequestSchema,
  todayInRentalZone,
  type BlockReason,
  type CreateBlockRequest,
} from '@ee/contracts';
import type { FieldErrors } from '../auth/formErrors';
import { daysToInstants, isCalendarDate } from './dateRange';

export const BLOCK_REASON_LABELS: Record<BlockReason, string> = {
  MAINTENANCE: 'Maintenance',
  TRANSPORT: 'In transport',
  HELD_BACK: 'Held back',
};

export interface BlockFormValues {
  unitId: string;
  reason: BlockReason;
  /** Whole Asia/Kolkata days, both included. */
  startDate: string;
  endDate: string;
  note: string;
}

export const emptyBlockForm = (unitId = '', now: Date = new Date()): BlockFormValues => {
  const today = todayInRentalZone(now);
  return { unitId, reason: 'MAINTENANCE', startDate: today, endDate: today, note: '' };
};

/** The machine to block and the request body, or field errors. */
export function validateBlock(
  values: BlockFormValues,
  now: Date = new Date(),
): { ok: true; unitId: string; value: CreateBlockRequest } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  if (!values.unitId) errors.unitId = 'Choose a machine.';
  const start = values.startDate.trim();
  const end = values.endDate.trim();
  if (!isCalendarDate(start)) errors.startDate = 'Enter a date as YYYY-MM-DD.';
  else if (start < todayInRentalZone(now)) errors.startDate = 'Blocks must start today or later.';
  if (!isCalendarDate(end)) errors.endDate = 'Enter a date as YYYY-MM-DD.';
  else if (isCalendarDate(start) && end < start) errors.endDate = 'End on or after the start date.';
  if (values.note.trim().length > 500) errors.note = 'Keep the note to 500 characters.';
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const parsed = createBlockRequestSchema.safeParse({
    reason: values.reason,
    ...daysToInstants(start, end),
    note: values.note.trim() || undefined,
  });
  return parsed.success
    ? { ok: true, unitId: values.unitId, value: parsed.data }
    : {
        ok: false,
        errors: { form: parsed.error.issues[0]?.message ?? 'Check the block details.' },
      };
}
