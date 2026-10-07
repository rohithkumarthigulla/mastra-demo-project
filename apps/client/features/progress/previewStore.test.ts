import {
  bookingSchema,
  quoteSchema,
  rentalRequestSchema,
  requirementDetailSchema,
} from '@ee/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import { MOCK_IDS } from './mocks';
import {
  createPreviewState,
  previewAcceptQuote,
  previewCancelBooking,
  previewCancelRequest,
  previewCancelRequirement,
  previewCreateRequest,
  previewCreateRequirement,
  previewMarkAllRead,
  previewMarkRead,
  previewRejectQuote,
  previewSendRequirement,
  type PreviewState,
} from './previewStore';

let s: PreviewState;
beforeEach(() => {
  s = createPreviewState('2026-10-07');
});

const request = (id: string) => s.requests.find((r) => r.id === id)!;

describe('previewAcceptQuote', () => {
  it('books the unit, closes sibling requests and awards the requirement', () => {
    const quote = previewAcceptQuote(s, MOCK_IDS.excavatorQuote);

    expect(quote.status).toBe('ACCEPTED');
    const booking = s.bookings.find((b) => b.id === quote.bookingId)!;
    expect(booking).toMatchObject({ status: 'CONFIRMED', quoteId: quote.id, total: quote.total });
    expect(booking.startAt).toBe('2026-10-11T18:30:00.000Z');
    expect(booking.endAt).toBe('2026-10-18T18:30:00.000Z');
    expect(() => bookingSchema.parse(booking)).not.toThrow();

    expect(request(MOCK_IDS.excavatorRequest).status).toBe('ACCEPTED');
    expect(request(MOCK_IDS.loaderRequest).status).toBe('WITHDRAWN');

    const requirement = s.requirements[0]!;
    expect(requirement).toMatchObject({ status: 'AWARDED', awardedQuoteId: quote.id });
    expect(requirement.invitations.map((i) => i.status)).toEqual(['ACCEPTED', 'WITHDRAWN']);
    expect(() => requirementDetailSchema.parse(requirement)).not.toThrow();
  });

  it('refuses a quote that is not awaiting a reply', () => {
    expect(() => previewAcceptQuote(s, MOCK_IDS.craneQuote)).toThrow();
  });
});

describe('previewRejectQuote', () => {
  it('keeps the request pending and updates its quote summary', () => {
    previewRejectQuote(s, MOCK_IDS.excavatorQuote);
    const req = request(MOCK_IDS.excavatorRequest);
    expect(req.status).toBe('PENDING');
    expect(req.latestQuote?.status).toBe('REJECTED');
    expect(s.requirements[0]!.invitations[0]!.quote?.status).toBe('REJECTED');
  });
});

describe('requests', () => {
  it('creates a valid pending request at the top of the list', () => {
    const created = previewCreateRequest(
      s,
      { listingId: MOCK_IDS.craneListing, startDate: '2026-10-08', endDate: '2026-10-09' },
      s.requests[1]!.listing,
      'Godavari Cranes',
    );
    expect(s.requests[0]).toBe(created);
    expect(created.days).toBe(2);
    expect(() => rentalRequestSchema.parse(created)).not.toThrow();
  });

  it('cancels only pending requests', () => {
    expect(previewCancelRequest(s, MOCK_IDS.loaderRequest).status).toBe('CANCELLED');
    expect(s.requirements[0]!.invitations[1]!.status).toBe('CANCELLED');
    expect(() => previewCancelRequest(s, MOCK_IDS.craneRequest)).toThrow();
  });
});

describe('previewCancelBooking', () => {
  it('records the reason and refuses a second cancel', () => {
    const booking = previewCancelBooking(s, MOCK_IDS.craneBooking, 'Site not ready');
    expect(booking).toMatchObject({ status: 'CANCELLED', cancelReason: 'Site not ready' });
    expect(() => previewCancelBooking(s, MOCK_IDS.craneBooking, 'again')).toThrow();
  });
});

describe('requirements', () => {
  const body = {
    title: 'Crane for slab work',
    categoryCode: 'CRANE',
    cityGeoId: 'IN-HYD',
    startDate: '2026-10-10',
    endDate: '2026-10-12',
    quantity: 1,
  };

  it('creates a draft and sending opens it with one request per new listing', () => {
    const created = previewCreateRequirement(s, body, 'Hyderabad');
    expect(created.status).toBe('DRAFT');

    const free = s.matches.find((m) => !m.alreadyInvited)!.listing.id;
    const result = previewSendRequirement(s, created.id, [free, free.replace(/.$/, '9')]);

    expect(result.sent).toHaveLength(1);
    expect(result.skipped).toEqual([{ listingId: free.replace(/.$/, '9'), reason: 'UNAVAILABLE' }]);
    expect(created).toMatchObject({ status: 'OPEN', invitationCount: 1 });
    expect(s.requests[0]!.requirementId).toBe(created.id);
    expect(() => requirementDetailSchema.parse(created)).not.toThrow();

    expect(previewSendRequirement(s, created.id, [free]).skipped[0]!.reason).toBe(
      'ALREADY_INVITED',
    );
  });

  it('cancelling closes pending invitations', () => {
    previewCancelRequirement(s, MOCK_IDS.requirement);
    expect(request(MOCK_IDS.excavatorRequest).status).toBe('CANCELLED');
    expect(request(MOCK_IDS.loaderRequest).status).toBe('CANCELLED');
    expect(() => previewCancelRequirement(s, MOCK_IDS.requirement)).toThrow();
  });
});

describe('notifications', () => {
  it('marks one, then the rest, read', () => {
    const unread = s.notifications.filter((n) => !n.readAt);
    previewMarkRead(s, unread[0]!.id);
    expect(previewMarkAllRead(s)).toEqual({ updated: unread.length - 1 });
    expect(s.notifications.every((n) => n.readAt)).toBe(true);
  });
});

it('quotes stay contract-valid after decisions', () => {
  previewAcceptQuote(s, MOCK_IDS.excavatorQuote);
  for (const q of s.quotes) expect(() => quoteSchema.parse(q)).not.toThrow();
});
