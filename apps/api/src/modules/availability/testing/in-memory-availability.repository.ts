import { randomUUID } from 'node:crypto';
import {
  overlaps,
  type AvailabilityRepository,
  type BlockFields,
  type BlockView,
  type BookingSlot,
  type TimeRange,
} from '../domain';

/** Mirrors the `maintenance_blocks_no_overlap` exclusion constraint. */
function exclusionViolation(): Error {
  return Object.assign(new Error('conflicting key value violates exclusion constraint'), {
    code: '23P01',
    constraint: 'maintenance_blocks_no_overlap',
  });
}

export class InMemoryAvailabilityRepository implements AvailabilityRepository {
  readonly blocks: BlockView[] = [];
  /** Active bookings; tests push here to occupy a unit. */
  readonly bookings: BookingSlot[] = [];
  /** Listing ids that are publicly visible (status ACTIVE). */
  readonly publicListings = new Set<string>();

  constructor(private readonly activeUnitIdsFor: (listingId: string) => string[]) {}

  findPublicListingUnitIds(listingId: string): Promise<string[] | null> {
    return Promise.resolve(
      this.publicListings.has(listingId) ? this.activeUnitIdsFor(listingId) : null,
    );
  }

  hasActiveOverlap(unitId: string, range: TimeRange): Promise<boolean> {
    return Promise.resolve(this.activeOverlapping([unitId], range).length > 0);
  }

  createBlock(fields: BlockFields, now: Date): Promise<BlockView> {
    if (
      this.activeOverlapping([fields.unitId], { start: fields.startAt, end: fields.endAt }).length
    ) {
      return Promise.reject(exclusionViolation());
    }
    const block: BlockView = {
      ...fields,
      id: randomUUID(),
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    this.blocks.push(block);
    return Promise.resolve({ ...block });
  }

  findBlock(id: string): Promise<BlockView | null> {
    const block = this.blocks.find((b) => b.id === id);
    return Promise.resolve(block ? { ...block } : null);
  }

  liftBlock(id: string, now: Date): Promise<boolean> {
    const block = this.blocks.find((b) => b.id === id);
    if (!block || block.status !== 'ACTIVE') return Promise.resolve(false);
    block.status = 'LIFTED';
    block.updatedAt = now;
    return Promise.resolve(true);
  }

  listActiveBlocks(unitIds: string[], range: TimeRange): Promise<BlockView[]> {
    return Promise.resolve(
      this.activeOverlapping(unitIds, range)
        .sort((a, b) => a.startAt.getTime() - b.startAt.getTime() || a.id.localeCompare(b.id))
        .map((b) => ({ ...b })),
    );
  }

  listActiveBookings(unitIds: string[], range: TimeRange): Promise<BookingSlot[]> {
    return Promise.resolve(
      this.bookings
        .filter(
          (b) => unitIds.includes(b.unitId) && overlaps({ start: b.startAt, end: b.endAt }, range),
        )
        .sort((a, b) => a.startAt.getTime() - b.startAt.getTime() || a.id.localeCompare(b.id))
        .map((b) => ({ ...b })),
    );
  }

  private activeOverlapping(unitIds: string[], range: TimeRange): BlockView[] {
    return this.blocks.filter(
      (b) =>
        unitIds.includes(b.unitId) &&
        b.status === 'ACTIVE' &&
        overlaps({ start: b.startAt, end: b.endAt }, range),
    );
  }
}
