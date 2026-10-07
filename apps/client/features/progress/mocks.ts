import {
  QUOTE_TAX_PERCENT,
  rentalDays,
  roundRupees,
  todayInRentalZone,
  type BookingDto,
  type ListingSummaryDto,
  type NotificationPageDto,
  type QuoteDto,
  type RentalRequestDto,
  type RequirementDetailDto,
  type RequirementMatchDto,
} from '@ee/contracts';

/**
 * Sample data shown while the rental endpoints still answer 501, so the builder flow can be
 * walked end to end. One coherent story: an excavator request with a quote waiting, a crane
 * already booked and out for delivery, a declined roller, and an open requirement.
 */

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const MOCK_IDS = {
  excavatorListing: uuid(1),
  craneListing: uuid(2),
  rollerListing: uuid(3),
  loaderListing: uuid(4),
  excavatorRequest: uuid(11),
  craneRequest: uuid(12),
  rollerRequest: uuid(13),
  loaderRequest: uuid(14),
  excavatorQuote: uuid(21),
  craneQuote: uuid(22),
  craneBooking: uuid(31),
  unit: uuid(41),
  requirement: uuid(51),
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function at(date: string, hour = 10): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + hour * 60 * 60 * 1000).toISOString();
}

function listing(id: string, title: string, pricePerDay: number): ListingSummaryDto {
  return { id, title, coverPhotoUrl: null, city: 'Hyderabad', pricePerDay };
}

const LISTINGS = {
  excavator: listing(MOCK_IDS.excavatorListing, 'JCB 3DX backhoe loader', 6500),
  crane: listing(MOCK_IDS.craneListing, 'ACE 14T pick-and-carry crane', 9000),
  roller: listing(MOCK_IDS.rollerListing, 'Volvo SD110 soil compactor', 7200),
  loader: listing(MOCK_IDS.loaderListing, 'CAT 424 backhoe loader', 6200),
};

const BUILDER = 'Sri Sai Constructions';

function request(
  id: string,
  item: ListingSummaryDto,
  supplierName: string,
  fields: Partial<RentalRequestDto> & { startDate: string; endDate: string; createdAt: string },
): RentalRequestDto {
  return {
    id,
    status: 'PENDING',
    requirementId: null,
    days: rentalDays(fields.startDate, fields.endDate),
    message: null,
    declineReason: null,
    viewedAt: null,
    listing: item,
    builderName: BUILDER,
    supplierName,
    latestQuote: null,
    updatedAt: fields.createdAt,
    ...fields,
  };
}

export function mockRentalRequests(today = todayInRentalZone()): RentalRequestDto[] {
  return [
    request(MOCK_IDS.excavatorRequest, LISTINGS.excavator, 'Deccan Earthmovers', {
      requirementId: MOCK_IDS.requirement,
      startDate: addDays(today, 5),
      endDate: addDays(today, 11),
      message: 'Foundation digging for a G+4 block in Kondapur.',
      viewedAt: at(addDays(today, -1), 11),
      latestQuote: { id: MOCK_IDS.excavatorQuote, status: 'SENT', total: 57_702 },
      createdAt: at(addDays(today, -2)),
      updatedAt: at(addDays(today, -1), 15),
    }),
    request(MOCK_IDS.craneRequest, LISTINGS.crane, 'Godavari Cranes', {
      status: 'ACCEPTED',
      startDate: addDays(today, 1),
      endDate: addDays(today, 3),
      viewedAt: at(addDays(today, -5), 9),
      latestQuote: { id: MOCK_IDS.craneQuote, status: 'ACCEPTED', total: 33_630 },
      createdAt: at(addDays(today, -6)),
      updatedAt: at(addDays(today, -4)),
    }),
    request(MOCK_IDS.rollerRequest, LISTINGS.roller, 'Telangana Infra Rentals', {
      status: 'REJECTED',
      startDate: addDays(today, 2),
      endDate: addDays(today, 4),
      declineReason: 'Machine is on another site that week.',
      viewedAt: at(addDays(today, -3), 12),
      createdAt: at(addDays(today, -3)),
      updatedAt: at(addDays(today, -3), 13),
    }),
    request(MOCK_IDS.loaderRequest, LISTINGS.loader, 'Hitech City Equipment', {
      requirementId: MOCK_IDS.requirement,
      startDate: addDays(today, 5),
      endDate: addDays(today, 11),
      message: 'Foundation digging for a G+4 block in Kondapur.',
      createdAt: at(addDays(today, -2)),
    }),
  ];
}

function quoteTotals(lines: QuoteDto['lines'], depositAmount: number) {
  const subtotal = roundRupees(lines.reduce((sum, l) => sum + l.amount, 0));
  const taxAmount = roundRupees((subtotal * QUOTE_TAX_PERCENT) / 100);
  return {
    subtotal,
    taxPercent: QUOTE_TAX_PERCENT,
    taxAmount,
    depositAmount,
    total: roundRupees(subtotal + taxAmount + depositAmount),
  };
}

function line(
  n: number,
  type: QuoteDto['lines'][number]['type'],
  description: string,
  quantity: number,
  unitAmount: number,
): QuoteDto['lines'][number] {
  const sign = type === 'DISCOUNT' ? -1 : 1;
  return {
    id: uuid(100 + n),
    type,
    description,
    quantity,
    unitAmount,
    amount: sign * quantity * unitAmount,
    position: n,
  };
}

export function mockQuotes(today = todayInRentalZone()): QuoteDto[] {
  const [excavatorReq, craneReq] = mockRentalRequests(today);
  const excavatorLines = [
    line(1, 'RENTAL', 'JCB 3DX, 7 days', 7, 6500),
    line(2, 'TRANSPORT', 'Delivery and pickup, Kondapur', 1, 4000),
    line(3, 'OPERATOR', 'Operator, 7 days', 7, 1200),
    line(4, 'DISCOUNT', 'Weekly discount', 1, 9000),
  ];
  const craneLines = [
    line(5, 'RENTAL', 'ACE 14T crane, 3 days', 3, 9000),
    line(6, 'TRANSPORT', 'Mobilisation', 1, 1500),
  ];
  return [
    {
      id: MOCK_IDS.excavatorQuote,
      status: 'SENT',
      equipmentUnitId: MOCK_IDS.unit,
      lines: excavatorLines,
      ...quoteTotals(excavatorLines, 0),
      notes: 'Diesel by site. Operator works 8-hour shifts.',
      validUntil: addDays(today, 3),
      autoDrafted: false,
      sentAt: at(addDays(today, -1), 15),
      decidedAt: null,
      rentalRequest: {
        id: excavatorReq.id,
        status: excavatorReq.status,
        startDate: excavatorReq.startDate,
        endDate: excavatorReq.endDate,
        days: excavatorReq.days,
        requirementId: excavatorReq.requirementId,
      },
      listing: excavatorReq.listing,
      builderName: BUILDER,
      supplierName: excavatorReq.supplierName,
      bookingId: null,
      createdAt: at(addDays(today, -1), 14),
      updatedAt: at(addDays(today, -1), 15),
    },
    {
      id: MOCK_IDS.craneQuote,
      status: 'ACCEPTED',
      equipmentUnitId: MOCK_IDS.unit,
      lines: craneLines,
      ...quoteTotals(craneLines, 0),
      notes: null,
      validUntil: null,
      autoDrafted: true,
      sentAt: at(addDays(today, -5), 10),
      decidedAt: at(addDays(today, -4)),
      rentalRequest: {
        id: craneReq.id,
        status: craneReq.status,
        startDate: craneReq.startDate,
        endDate: craneReq.endDate,
        days: craneReq.days,
        requirementId: null,
      },
      listing: craneReq.listing,
      builderName: BUILDER,
      supplierName: craneReq.supplierName,
      bookingId: MOCK_IDS.craneBooking,
      createdAt: at(addDays(today, -5), 9),
      updatedAt: at(addDays(today, -4)),
    },
  ];
}

export function mockBookings(today = todayInRentalZone()): BookingDto[] {
  const craneQuote = mockQuotes(today)[1]!;
  const { startDate, endDate, days } = craneQuote.rentalRequest;
  return [
    {
      id: MOCK_IDS.craneBooking,
      status: 'OUT_FOR_DELIVERY',
      quoteId: craneQuote.id,
      rentalRequestId: craneQuote.rentalRequest.id,
      equipmentUnitId: MOCK_IDS.unit,
      // Midnight in Asia/Kolkata is 18:30 UTC the previous day.
      startAt: at(addDays(startDate, -1), 18.5),
      endAt: at(endDate, 18.5),
      startDate,
      endDate,
      days,
      total: craneQuote.total,
      listing: craneQuote.listing,
      builderName: BUILDER,
      supplierName: craneQuote.supplierName,
      dispatchedAt: at(today, 7),
      rentStartedAt: null,
      returnedAt: null,
      cancelledAt: null,
      cancelReason: null,
      createdAt: at(addDays(today, -4)),
      updatedAt: at(today, 7),
    },
  ];
}

export function mockRequirement(today = todayInRentalZone()): RequirementDetailDto {
  const requests = mockRentalRequests(today);
  const invited = [requests[0]!, requests[3]!];
  return {
    id: MOCK_IDS.requirement,
    status: 'OPEN',
    title: 'Backhoe loader for foundation digging',
    categoryCode: 'BACKHOE_LOADER',
    equipmentModelId: null,
    constructionTaskCode: null,
    city: { geoId: 'IN-HYD', name: 'Hyderabad' },
    startDate: addDays(today, 5),
    endDate: addDays(today, 11),
    days: 7,
    quantity: 1,
    budgetPerDay: 7000,
    notes: 'Foundation digging for a G+4 block in Kondapur.',
    sentAt: at(addDays(today, -2)),
    awardedQuoteId: null,
    invitationCount: invited.length,
    createdAt: at(addDays(today, -2), 9),
    updatedAt: at(addDays(today, -2)),
    invitations: invited.map((r) => ({
      rentalRequestId: r.id,
      listingId: r.listing.id,
      listingTitle: r.listing.title,
      supplierName: r.supplierName,
      status: r.status,
      viewedAt: r.viewedAt,
      quote: r.latestQuote,
    })),
  };
}

export function mockRequirementMatches(): RequirementMatchDto[] {
  return [
    {
      listing: LISTINGS.excavator,
      supplierName: 'Deccan Earthmovers',
      availableUnits: 2,
      alreadyInvited: true,
    },
    {
      listing: LISTINGS.loader,
      supplierName: 'Hitech City Equipment',
      availableUnits: 1,
      alreadyInvited: true,
    },
    {
      listing: listing(uuid(5), 'Mahindra EarthMaster SX', 5800),
      supplierName: 'Nizam Machinery Hire',
      availableUnits: 3,
      alreadyInvited: false,
    },
  ];
}

export function mockNotifications(today = todayInRentalZone()): NotificationPageDto {
  const items: NotificationPageDto['items'] = [
    {
      id: uuid(61),
      kind: 'BOOKING_CONFIRMED',
      title: 'Crane is out for delivery',
      detail: 'Godavari Cranes dispatched the ACE 14T crane.',
      href: `/bookings/${MOCK_IDS.craneBooking}`,
      tone: 'good',
      readAt: null,
      createdAt: at(today, 7),
    },
    {
      id: uuid(62),
      kind: 'QUOTE_RECEIVED',
      title: 'New quote from Deccan Earthmovers',
      detail: 'JCB 3DX backhoe loader for 7 days.',
      href: `/quotes/${MOCK_IDS.excavatorQuote}`,
      tone: 'good',
      readAt: null,
      createdAt: at(addDays(today, -1), 15),
    },
    {
      id: uuid(63),
      kind: 'JOB_VIEWED',
      title: 'Deccan Earthmovers viewed your request',
      detail: null,
      href: `/requests/${MOCK_IDS.excavatorRequest}`,
      tone: 'waiting',
      readAt: at(addDays(today, -1), 12),
      createdAt: at(addDays(today, -1), 11),
    },
    {
      id: uuid(64),
      kind: 'REQUEST_DECLINED',
      title: 'Telangana Infra Rentals declined your request',
      detail: 'Machine is on another site that week.',
      href: `/requests/${MOCK_IDS.rollerRequest}`,
      tone: 'neutral',
      readAt: at(addDays(today, -3), 14),
      createdAt: at(addDays(today, -3), 13),
    },
  ];
  return {
    items,
    total: items.length,
    limit: 20,
    offset: 0,
    unreadCount: items.filter((n) => n.readAt === null).length,
  };
}

/** Wraps fixtures as a list page, honouring limit/offset like the api would. */
export function mockPage<T>(items: T[], query: { limit?: number; offset?: number } = {}) {
  const limit = query.limit ?? 20;
  const offset = query.offset ?? 0;
  return { items: items.slice(offset, offset + limit), total: items.length, limit, offset };
}
