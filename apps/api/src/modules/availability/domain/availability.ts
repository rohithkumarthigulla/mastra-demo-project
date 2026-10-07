import type { BlockReason, BlockStatus } from '@ee/contracts';
import { BlockInPastError } from './errors';

/** Half-open `[start, end)`: a range ending at 10:00 does not touch one starting at 10:00. */
export interface TimeRange {
  start: Date;
  end: Date;
}

export function overlaps(a: TimeRange, b: TimeRange): boolean {
  return a.start < b.end && b.start < a.end;
}

/** `endAt > startAt` is guaranteed by the request contract and the DB check. */
export function assertBlockNotInPast(startAt: Date, now: Date): void {
  if (startAt < now) throw new BlockInPastError();
}

export interface BlockFields {
  unitId: string;
  reason: BlockReason;
  startAt: Date;
  endAt: Date;
  note: string | null;
  createdBy: string;
}

export interface BlockView extends BlockFields {
  id: string;
  status: BlockStatus;
  createdAt: Date;
  updatedAt: Date;
}

/** An active booking (CONFIRMED, OUT_FOR_DELIVERY or ON_RENT) holding a unit. */
export interface BookingSlot {
  id: string;
  unitId: string;
  startAt: Date;
  endAt: Date;
}
