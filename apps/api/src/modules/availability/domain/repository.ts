import type { BlockFields, BlockView, BookingSlot, TimeRange } from './availability';

export const AVAILABILITY_REPOSITORY = Symbol('AVAILABILITY_REPOSITORY');

export interface AvailabilityRepository {
  /** ACTIVE unit ids of a publicly visible (ACTIVE) listing; `null` if the listing is not public. */
  findPublicListingUnitIds(listingId: string): Promise<string[] | null>;
  hasActiveOverlap(unitId: string, range: TimeRange): Promise<boolean>;
  /** Throws a Postgres exclusion_violation (23P01) if an ACTIVE block overlaps. */
  createBlock(fields: BlockFields, now: Date): Promise<BlockView>;
  findBlock(id: string): Promise<BlockView | null>;
  /** Compare-and-set ACTIVE → LIFTED; `false` if the block was not ACTIVE. */
  liftBlock(id: string, now: Date): Promise<boolean>;
  /** ACTIVE blocks of `unitIds` overlapping `range`, ordered by start. */
  listActiveBlocks(unitIds: string[], range: TimeRange): Promise<BlockView[]>;
  /** Active bookings of `unitIds` overlapping `range`, ordered by start. */
  listActiveBookings(unitIds: string[], range: TimeRange): Promise<BookingSlot[]>;
}
