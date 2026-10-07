import {
  roundRupees,
  type BookingDto,
  type BookingStatus,
  type QuoteStatus,
  type RentalRequestDto,
  type RentalRequestStatus,
} from '@ee/contracts';

export const TRACKER_COLUMNS = [
  'NEW_REQUESTS',
  'QUOTE_TO_SEND',
  'AWAITING_BUILDER',
  'CONFIRMED',
  'OUT_FOR_DELIVERY',
  'ON_RENT',
  'RETURNED',
] as const;
export type TrackerColumn = (typeof TRACKER_COLUMNS)[number];

export const TRACKER_COLUMN_LABELS: Record<TrackerColumn, string> = {
  NEW_REQUESTS: 'New requests',
  QUOTE_TO_SEND: 'Quote to send',
  AWAITING_BUILDER: 'Awaiting builder',
  CONFIRMED: 'Confirmed',
  OUT_FOR_DELIVERY: 'Out for delivery',
  ON_RENT: 'On rent',
  RETURNED: 'Returned',
};

/** Where a quote's work sits. `null` means closed: not on the board. */
export function quoteColumn(status: QuoteStatus): TrackerColumn | null {
  switch (status) {
    case 'DRAFT':
    case 'PENDING_APPROVAL':
      return 'QUOTE_TO_SEND';
    case 'SENT':
      return 'AWAITING_BUILDER';
    case 'ACCEPTED':
      return 'CONFIRMED';
    case 'REJECTED':
    case 'EXPIRED':
      return null;
  }
}

/**
 * Where a request sits, given its latest quote. A pending request whose quote was rejected
 * or expired needs a new quote, so it goes back to New requests. An accepted request is
 * represented by its booking.
 */
export function requestColumn(
  status: RentalRequestStatus,
  latestQuoteStatus: QuoteStatus | null,
): TrackerColumn | null {
  switch (status) {
    case 'PENDING':
      return (latestQuoteStatus && quoteColumn(latestQuoteStatus)) ?? 'NEW_REQUESTS';
    case 'ACCEPTED':
      return 'CONFIRMED';
    case 'REJECTED':
    case 'CANCELLED':
    case 'WITHDRAWN':
      return null;
  }
}

export function bookingColumn(status: BookingStatus): TrackerColumn | null {
  return status === 'CANCELLED' ? null : status;
}

export interface TrackerCard {
  /** What the card opens. */
  kind: 'request' | 'quote' | 'booking';
  id: string;
  column: TrackerColumn;
  title: string;
  builderName: string;
  startDate: string;
  endDate: string;
  amount: number | null;
}

export type TrackerBoard = Record<TrackerColumn, TrackerCard[]>;

export interface TrackerInput {
  requests: RentalRequestDto[];
  bookings: BookingDto[];
}

/**
 * Places every open request and booking in a column. A request that already has a
 * booking is shown once, as the booking.
 */
export function buildBoard({ requests, bookings }: TrackerInput): {
  board: TrackerBoard;
  closed: number;
} {
  const board = Object.fromEntries(TRACKER_COLUMNS.map((c) => [c, []])) as unknown as TrackerBoard;
  let closed = 0;
  const booked = new Set(bookings.map((booking) => booking.rentalRequestId));

  for (const request of requests) {
    if (booked.has(request.id)) continue;
    const quote = request.latestQuote;
    const column = requestColumn(request.status, quote?.status ?? null);
    if (!column) {
      closed++;
      continue;
    }
    const opensQuote = quote !== null && quoteColumn(quote.status) === column;
    board[column].push({
      kind: opensQuote ? 'quote' : 'request',
      id: opensQuote ? quote.id : request.id,
      column,
      title: request.listing.title,
      builderName: request.builderName,
      startDate: request.startDate,
      endDate: request.endDate,
      amount: opensQuote ? quote.total : null,
    });
  }

  for (const booking of bookings) {
    const column = bookingColumn(booking.status);
    if (!column) {
      closed++;
      continue;
    }
    board[column].push({
      kind: 'booking',
      id: booking.id,
      column,
      title: booking.listing.title,
      builderName: booking.builderName,
      startDate: booking.startDate,
      endDate: booking.endDate,
      amount: booking.total,
    });
  }

  for (const column of TRACKER_COLUMNS) {
    board[column].sort((a, b) => a.startDate.localeCompare(b.startDate));
  }
  return { board, closed };
}

export interface TrackerSummary {
  counts: Record<TrackerColumn, number>;
  /** Sum of the totals of bookings in the Confirmed column. */
  confirmedValue: number;
}

export function summarise(board: TrackerBoard): TrackerSummary {
  const counts = Object.fromEntries(
    TRACKER_COLUMNS.map((column) => [column, board[column].length]),
  ) as Record<TrackerColumn, number>;
  const confirmedValue = board.CONFIRMED.filter((card) => card.kind === 'booking').reduce(
    (sum, card) => roundRupees(sum + (card.amount ?? 0)),
    0,
  );
  return { counts, confirmedValue };
}
