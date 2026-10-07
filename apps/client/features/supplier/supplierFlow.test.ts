import type { BookingDto, BookingStatus, QuoteDto } from '@ee/contracts';
import { describe, expect, it } from 'vitest';
import { createApiClient } from '../../api/client';
import type { AuthStorage } from '../../platform/types';
import { nextBookingStep } from './bookingActions';
import { bookingFixture, quoteFixture } from './fixtures';
import {
  previewableLines,
  toCreateQuote,
  validateQuoteForSend,
  type QuoteDraft,
} from './quoteForm';
import { previewTotals } from './quoteMath';

// Quotes and bookings return 501 until the rental API lands, so these tests drive the
// screens' calls through the typed client against sample responses shaped by the contracts.

const UNIT = '22222222-2222-4222-8222-222222222222';
const REQUEST = '44444444-4444-4444-8444-444444444444';

const storage: AuthStorage = {
  clientKind: 'web',
  getAccessToken: () => 'token',
  setAccessToken: () => {},
  getRefreshToken: async () => null,
  setRefreshToken: async () => {},
  clear: async () => {},
};

function mockApi(respond: (method: string, path: string, body: unknown) => unknown) {
  const seen: string[] = [];
  const fetchImpl = (async (input: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const path = new URL(input).pathname;
    seen.push(`${method} ${path}`);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    return new Response(JSON.stringify(respond(method, path, body)), {
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
  const api = createApiClient({
    baseUrl: 'http://api.test',
    storage,
    onSessionExpired: () => {},
    fetch: fetchImpl,
  });
  return { api, seen };
}

// Five-day rental with transport, an operator, a deposit and a discount. The server's
// figures are worked out by hand from docs/contracts.md ("Totals").
const draft: QuoteDraft = {
  equipmentUnitId: UNIT,
  notes: 'Operator for all five days.',
  validUntil: '',
  lines: [
    { key: 'a', type: 'RENTAL', description: 'JCB 3DX', quantity: '5', unitAmount: '12500' },
    {
      key: 'b',
      type: 'TRANSPORT',
      description: 'Delivery and pickup',
      quantity: '1',
      unitAmount: '4000.50',
    },
    { key: 'c', type: 'OPERATOR', description: 'Operator', quantity: '5', unitAmount: '1333.33' },
    {
      key: 'd',
      type: 'DEPOSIT',
      description: 'Refundable deposit',
      quantity: '1',
      unitAmount: '25000',
    },
    {
      key: 'e',
      type: 'DISCOUNT',
      description: 'Repeat customer',
      quantity: '1',
      unitAmount: '2500',
    },
  ],
};
// 62500 + 4000.50 + 6666.65 − 2500 = 70667.15; GST 18% = 12720.087 → 12720.09.
const SERVER = { subtotal: 70667.15, taxAmount: 12720.09, depositAmount: 25000, total: 108387.24 };

describe('supplier quote and booking flow (mocked)', () => {
  it('creates a quote with every line type whose preview matches the saved totals, then sends it', async () => {
    const checked = validateQuoteForSend(draft);
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;

    const saved = quoteFixture({ equipmentUnitId: UNIT, ...SERVER });
    const { api, seen } = mockApi((method, path, body) => {
      if (method === 'POST' && path === '/quotes') {
        expect(body).toEqual(toCreateQuote(REQUEST, checked.value));
        return saved;
      }
      return { ...saved, status: 'SENT', sentAt: '2026-10-07T07:00:00.000Z' } satisfies QuoteDto;
    });

    const created = await api.quotes.create(toCreateQuote(REQUEST, checked.value));
    expect(previewTotals(previewableLines(draft.lines))).toEqual({
      subtotal: created.subtotal,
      taxAmount: created.taxAmount,
      depositAmount: created.depositAmount,
      total: created.total,
    });

    const sent = await api.quotes.send(created.id);
    expect(sent.status).toBe('SENT');
    expect(seen).toEqual(['POST /quotes', `POST /quotes/${saved.id}/send`]);
  });

  it('refuses to send without a rental line or a machine', () => {
    const noRental = validateQuoteForSend({
      ...draft,
      lines: draft.lines.filter((l) => l.type !== 'RENTAL'),
    });
    const noMachine = validateQuoteForSend({ ...draft, equipmentUnitId: '' });
    expect(noRental.ok).toBe(false);
    expect(noMachine.ok).toBe(false);
  });

  it('walks a booking from confirmed to returned using the next step at each stage', async () => {
    const after: Record<string, BookingStatus> = {
      dispatch: 'OUT_FOR_DELIVERY',
      'start-rent': 'ON_RENT',
      complete: 'RETURNED',
    };
    let booking: BookingDto = bookingFixture();
    const { api, seen } = mockApi((_method, path) => {
      const action = path.split('/').pop()!;
      booking = { ...booking, status: after[action]! };
      return booking;
    });

    const statuses: BookingStatus[] = [booking.status];
    for (let step = nextBookingStep(booking.status); step; step = nextBookingStep(booking.status)) {
      booking = await api.bookings[step.action](booking.id);
      statuses.push(booking.status);
    }

    expect(statuses).toEqual(['CONFIRMED', 'OUT_FOR_DELIVERY', 'ON_RENT', 'RETURNED']);
    expect(seen).toEqual([
      `POST /bookings/${booking.id}/dispatch`,
      `POST /bookings/${booking.id}/start-rent`,
      `POST /bookings/${booking.id}/complete`,
    ]);
  });
});
