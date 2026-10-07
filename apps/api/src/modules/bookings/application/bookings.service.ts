import { Inject, Injectable } from '@nestjs/common';
import type { BookingDto, BookingPageDto, ListBookingsQuery } from '@ee/contracts';
import { and, eq } from 'drizzle-orm';
import { CLOCK, type Clock } from '../../../platform/auth';
import { DB, type Database } from '../../../platform/database';
import { bookings } from '../../../platform/database/schema';
import {
  BookingNotFoundError,
  InvalidBookingTransitionError,
  nextBookingStatus,
  type BookingAction,
} from '../domain';
import {
  findBookingDto,
  listBookingDtos,
  type BookingViewer,
} from '../infrastructure/booking.reader';

const STAMP: Record<
  BookingAction,
  'dispatchedAt' | 'rentStartedAt' | 'returnedAt' | 'cancelledAt'
> = {
  dispatch: 'dispatchedAt',
  'start-rent': 'rentStartedAt',
  complete: 'returnedAt',
  cancel: 'cancelledAt',
};

@Injectable()
export class BookingsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async list(viewer: BookingViewer, query: ListBookingsQuery): Promise<BookingPageDto> {
    const page = await listBookingDtos(this.db, viewer, { status: query.status }, query);
    return { ...page, limit: query.limit, offset: query.offset };
  }

  async get(viewer: BookingViewer, id: string): Promise<BookingDto> {
    const booking = await findBookingDto(this.db, viewer, id);
    if (!booking) throw new BookingNotFoundError();
    return booking;
  }

  /** Moves the booking one step; a concurrent change of status makes this a 409, not a double step. */
  async transition(
    viewer: BookingViewer,
    id: string,
    action: BookingAction,
    cancelReason?: string,
  ): Promise<BookingDto> {
    const booking = await this.get(viewer, id);
    const next = nextBookingStatus(booking.status, action);
    if (!next) throw new InvalidBookingTransitionError();
    const now = this.clock.now();
    const changed = await this.db
      .update(bookings)
      .set({
        status: next,
        [STAMP[action]]: now,
        ...(action === 'cancel' ? { cancelReason } : {}),
        updatedAt: now,
      })
      .where(and(eq(bookings.id, booking.id), eq(bookings.status, booking.status)))
      .returning({ id: bookings.id });
    if (changed.length === 0) throw new InvalidBookingTransitionError();
    return this.get(viewer, id);
  }
}
