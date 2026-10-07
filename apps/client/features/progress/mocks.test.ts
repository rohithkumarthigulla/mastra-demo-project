import {
  bookingSchema,
  notificationPageSchema,
  quoteSchema,
  rentalDays,
  rentalRequestSchema,
  requirementDetailSchema,
  requirementMatchSchema,
} from '@ee/contracts';
import { describe, expect, it } from 'vitest';
import {
  mockBookings,
  mockNotifications,
  mockPage,
  mockQuotes,
  mockRentalRequests,
  mockRequirement,
  mockRequirementMatches,
} from './mocks';

const TODAY = '2026-10-07';

describe('mock fixtures match the contracts', () => {
  it.each([
    ['rental requests', () => mockRentalRequests(TODAY), rentalRequestSchema],
    ['quotes', () => mockQuotes(TODAY), quoteSchema],
    ['bookings', () => mockBookings(TODAY), bookingSchema],
    ['requirement matches', mockRequirementMatches, requirementMatchSchema],
  ] as const)('%s', (_, build, schema) => {
    for (const item of build()) expect(() => schema.parse(item)).not.toThrow();
  });

  it('requirement detail', () => {
    expect(() => requirementDetailSchema.parse(mockRequirement(TODAY))).not.toThrow();
  });

  it('notifications', () => {
    expect(() => notificationPageSchema.parse(mockNotifications(TODAY))).not.toThrow();
  });
});

describe('mock fixtures tell one consistent story', () => {
  const requests = mockRentalRequests(TODAY);
  const quotes = mockQuotes(TODAY);

  it('request summaries agree with their quotes', () => {
    for (const quote of quotes) {
      const req = requests.find((r) => r.id === quote.rentalRequest.id)!;
      expect(req.latestQuote).toEqual({ id: quote.id, status: quote.status, total: quote.total });
    }
  });

  it('quote totals add up', () => {
    for (const q of quotes) {
      expect(q.subtotal).toBe(q.lines.reduce((sum, l) => sum + l.amount, 0));
      expect(q.total).toBe(q.subtotal + q.taxAmount + q.depositAmount);
    }
  });

  it('day counts match the dates', () => {
    for (const r of [...requests, ...mockBookings(TODAY), mockRequirement(TODAY)]) {
      expect(r.days).toBe(rentalDays(r.startDate, r.endDate));
    }
  });

  it('booking boundaries are midnight in Asia/Kolkata', () => {
    const [booking] = mockBookings(TODAY);
    expect(booking!.startAt).toBe('2026-10-07T18:30:00.000Z');
    expect(booking!.endAt).toBe('2026-10-10T18:30:00.000Z');
  });

  it('unread count matches the items', () => {
    const page = mockNotifications(TODAY);
    expect(page.unreadCount).toBe(page.items.filter((n) => !n.readAt).length);
  });
});

describe('mockPage', () => {
  it('slices by limit and offset and reports the full total', () => {
    expect(mockPage([1, 2, 3, 4, 5], { limit: 2, offset: 2 })).toEqual({
      items: [3, 4],
      total: 5,
      limit: 2,
      offset: 2,
    });
  });
});
