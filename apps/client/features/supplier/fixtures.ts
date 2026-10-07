// Sample api responses for tests. Each one is parsed with its contract schema in
// fixtures.test.ts, so they stay valid while the endpoints return 501.
import type {
  BookingDto,
  BookingStatus,
  EquipmentUnitDto,
  FleetCalendarDto,
  QuoteDto,
  QuoteStatus,
  RentalRequestDto,
  RentalRequestStatus,
} from '@ee/contracts';

let counter = 0;
/** A deterministic, valid v4 uuid. */
export function fixtureId(): string {
  counter += 1;
  return `00000000-0000-4000-8000-${counter.toString(16).padStart(12, '0')}`;
}

const NOW = '2026-10-07T06:30:00.000Z';

const listing = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'JCB 3DX backhoe loader',
  coverPhotoUrl: null,
  city: 'Hyderabad',
  pricePerDay: 12500,
};

export function requestFixture(
  overrides: Partial<RentalRequestDto> & { status?: RentalRequestStatus } = {},
): RentalRequestDto {
  return {
    id: fixtureId(),
    status: 'PENDING',
    requirementId: null,
    startDate: '2026-10-20',
    endDate: '2026-10-24',
    days: 5,
    message: 'Need it for foundation work.',
    declineReason: null,
    viewedAt: null,
    listing,
    builderName: 'Asha Constructions',
    supplierName: 'Ravi Earthmovers',
    latestQuote: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function quoteFixture(
  overrides: Partial<QuoteDto> & { status?: QuoteStatus } = {},
): QuoteDto {
  return {
    id: fixtureId(),
    status: 'DRAFT',
    equipmentUnitId: null,
    lines: [
      {
        id: fixtureId(),
        type: 'RENTAL',
        description: 'Rental',
        quantity: 5,
        unitAmount: 12500,
        amount: 62500,
        position: 0,
      },
    ],
    subtotal: 62500,
    taxPercent: 18,
    taxAmount: 11250,
    depositAmount: 0,
    total: 73750,
    notes: null,
    validUntil: null,
    autoDrafted: false,
    sentAt: null,
    decidedAt: null,
    rentalRequest: {
      id: fixtureId(),
      status: 'PENDING',
      startDate: '2026-10-20',
      endDate: '2026-10-24',
      days: 5,
      requirementId: null,
    },
    listing,
    builderName: 'Asha Constructions',
    supplierName: 'Ravi Earthmovers',
    bookingId: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function bookingFixture(
  overrides: Partial<BookingDto> & { status?: BookingStatus } = {},
): BookingDto {
  return {
    id: fixtureId(),
    status: 'CONFIRMED',
    quoteId: fixtureId(),
    rentalRequestId: fixtureId(),
    equipmentUnitId: fixtureId(),
    startAt: '2026-10-19T18:30:00.000Z',
    endAt: '2026-10-24T18:30:00.000Z',
    startDate: '2026-10-20',
    endDate: '2026-10-24',
    days: 5,
    total: 73750,
    listing,
    builderName: 'Asha Constructions',
    supplierName: 'Ravi Earthmovers',
    dispatchedAt: null,
    rentStartedAt: null,
    returnedAt: null,
    cancelledAt: null,
    cancelReason: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function fleetCalendarFixture(): FleetCalendarDto {
  return {
    from: '2026-10-06T18:30:00.000Z',
    to: '2026-11-05T18:30:00.000Z',
    lanes: [
      {
        unitId: '22222222-2222-4222-8222-222222222222',
        label: 'Unit A',
        yard: { id: '33333333-3333-4333-8333-333333333333', name: 'Kompally yard' },
        from: '2026-10-06T18:30:00.000Z',
        to: '2026-11-05T18:30:00.000Z',
        slots: [
          {
            state: 'BLOCKED',
            startAt: '2026-10-09T18:30:00.000Z',
            endAt: '2026-10-16T18:30:00.000Z',
            source: { type: 'BLOCK', id: '44444444-4444-4444-8444-444444444444' },
            reason: 'MAINTENANCE',
            note: 'Hydraulic service',
          },
        ],
      },
      {
        unitId: '55555555-5555-4555-8555-555555555555',
        label: null,
        yard: { id: '33333333-3333-4333-8333-333333333333', name: 'Kompally yard' },
        from: '2026-10-06T18:30:00.000Z',
        to: '2026-11-05T18:30:00.000Z',
        slots: [
          {
            state: 'BOOKED',
            startAt: '2026-10-19T18:30:00.000Z',
            endAt: '2026-10-24T18:30:00.000Z',
            source: { type: 'BOOKING', id: '66666666-6666-4666-8666-666666666666' },
          },
        ],
      },
    ],
  };
}

export function unitFixture(overrides: Partial<EquipmentUnitDto> = {}): EquipmentUnitDto {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    listing: { id: listing.id, title: listing.title },
    model: {
      id: '77777777-7777-4777-8777-777777777777',
      modelName: '3DX',
      manufacturer: { id: '88888888-8888-4888-8888-888888888888', name: 'JCB' },
    },
    yard: {
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Kompally yard',
      city: { geoId: 'IN-HYD', name: 'Hyderabad' },
    },
    modelYear: 2021,
    condition: 'GOOD',
    label: 'Unit A',
    status: 'ACTIVE',
    identifiers: [{ type: 'SERIAL_NUMBER', value: 'JCB3DX-0091' }],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}
