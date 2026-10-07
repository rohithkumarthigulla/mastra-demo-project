import {
  blockReasonSchema,
  calendarDateSchema,
  listingPricePerDaySchema,
  MAX_CALENDAR_DAYS,
  type BlockReason,
  type PendingActionType,
} from '@ee/contracts';
import { numberArg, stringArg, type Tool } from '../../ai/application';
import type { AvailabilityService } from '../../availability/application';
import type { EquipmentListingsService } from '../../equipment-listings/application';
import type { FleetService } from '../../fleet/application';
import type { ActionPayload } from '../domain';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ROWS = 50;
/** Rental dates are Asia/Kolkata calendar days; a day starts at local midnight. */
const RENTAL_ZONE_OFFSET = '+05:30';

/** A change the agent proposed during one reply. Only one proposal is kept per reply. */
export interface Proposal {
  type: PendingActionType;
  payload: ActionPayload;
}

export class AgentToolState {
  proposal: Proposal | null = null;
}

interface Deps {
  accountId: string;
  now: Date;
  fleet: FleetService;
  availability: AvailabilityService;
  listings: EquipmentListingsService;
}

/** Midnight at the start of `date` in the rental zone. */
export function startOfRentalDay(date: string): Date {
  return new Date(`${date}T00:00:00${RENTAL_ZONE_OFFSET}`);
}

/**
 * Tools for the supplier agent. Read tools only ever see the signed-in supplier's data because
 * every call goes through a service that scopes by `accountId`. Write tools only record a
 * proposal; nothing changes until the supplier confirms it.
 */
export function agentTools(deps: Deps, state: AgentToolState): Tool[] {
  const { accountId, fleet, availability, listings } = deps;

  const propose = (type: PendingActionType, summary: string, args: Record<string, unknown>) => {
    if (state.proposal) return { error: 'Only one change can be proposed per reply.' };
    state.proposal = { type, payload: { summary, args } };
    return { proposed: true, summary, note: 'The supplier must confirm before anything changes.' };
  };

  return [
    {
      definition: {
        name: 'list_yards',
        description: "List the supplier's yards.",
        parameters: { type: 'object', properties: {} },
      },
      run: async () => ({
        yards: (await fleet.listYards(accountId)).map((y) => ({
          id: y.id,
          name: y.name,
          city: y.city.name,
        })),
      }),
    },
    {
      definition: {
        name: 'list_units',
        description:
          "List the supplier's machines (fleet units) with their model, yard and status.",
        parameters: { type: 'object', properties: {} },
      },
      run: async () => ({
        units: (await fleet.listUnits(accountId, {})).slice(0, MAX_ROWS).map((u) => ({
          id: u.id,
          label: u.label,
          model: { modelName: u.model.modelName, manufacturer: u.model.manufacturer.name },
          listing: u.listing.title,
          yard: u.yard.name,
          status: u.status,
        })),
      }),
    },
    {
      definition: {
        name: 'list_listings',
        description: "List the supplier's listings with status and price per day in rupees.",
        parameters: { type: 'object', properties: {} },
      },
      run: async () => ({
        listings: (await listings.listOwn(accountId, { limit: MAX_ROWS, offset: 0 })).items.map(
          (l) => ({
            id: l.id,
            title: l.title,
            status: l.status,
            pricePerDay: l.pricePerDay,
            model: { modelName: l.model.modelName },
            city: l.city.name,
          }),
        ),
      }),
    },
    {
      definition: {
        name: 'get_availability',
        description:
          "Show active blocks on the supplier's machines between two dates (YYYY-MM-DD, at most 92 days). Block ids are needed to lift a block.",
        parameters: {
          type: 'object',
          properties: {
            fromDate: { type: 'string', description: 'First day, YYYY-MM-DD' },
            toDate: { type: 'string', description: 'Last day, YYYY-MM-DD' },
          },
          required: ['fromDate', 'toDate'],
        },
      },
      run: async (args) => {
        const range = dayRange(stringArg(args, 'fromDate'), stringArg(args, 'toDate'));
        if ('error' in range) return range;
        if (range.end.getTime() - range.start.getTime() > MAX_CALENDAR_DAYS * DAY_MS) {
          return { error: `Ask for at most ${MAX_CALENDAR_DAYS} days at a time.` };
        }
        const lanes = await availability.fleetCalendar(accountId, range);
        return {
          units: lanes.map((lane) => ({
            unitId: lane.unit.id,
            label: lane.unit.label,
            model: lane.unit.model.modelName,
            blocks: lane.blocks.map((b) => ({
              id: b.id,
              reason: b.reason,
              startAt: b.startAt.toISOString(),
              endAt: b.endAt.toISOString(),
            })),
          })),
        };
      },
    },
    {
      definition: {
        name: 'list_rental_requests',
        description: "List the supplier's incoming rental requests, quotes and bookings.",
        parameters: { type: 'object', properties: {} },
      },
      run: () =>
        Promise.resolve({
          error: 'Rental requests, quotes and bookings are not available to the assistant yet.',
        }),
    },
    {
      definition: {
        name: 'propose_block_unit',
        description:
          'Propose blocking one machine for whole days (YYYY-MM-DD, both included). Does not change anything until the supplier confirms.',
        parameters: {
          type: 'object',
          properties: {
            unitId: { type: 'string', description: 'Unit id from list_units' },
            startDate: { type: 'string', description: 'First blocked day, YYYY-MM-DD' },
            endDate: { type: 'string', description: 'Last blocked day, YYYY-MM-DD' },
            reason: { type: 'string', description: 'MAINTENANCE, TRANSPORT or HELD_BACK' },
          },
          required: ['unitId', 'startDate', 'endDate', 'reason'],
        },
      },
      run: async (args) => {
        const reason = blockReasonSchema.safeParse(stringArg(args, 'reason')?.toUpperCase());
        if (!reason.success)
          return { error: 'reason must be MAINTENANCE, TRANSPORT or HELD_BACK.' };
        const startDate = stringArg(args, 'startDate');
        const endDate = stringArg(args, 'endDate');
        const range = dayRange(startDate, endDate);
        if ('error' in range) return range;
        if (range.end <= deps.now) return { error: 'Those days are already in the past.' };
        const unit = await fleet.getUnit(accountId, stringArg(args, 'unitId') ?? '');
        if (unit.status !== 'ACTIVE') return { error: 'That machine is retired.' };
        const name = unit.label ?? `${unit.model.manufacturer.name} ${unit.model.modelName}`;
        return propose(
          'BLOCK_UNIT',
          `Block ${name} (${unit.yard.name}) from ${startDate} to ${endDate} for ${describeReason(reason.data)}.`,
          {
            unitId: unit.id,
            reason: reason.data,
            startAt: range.start.toISOString(),
            endAt: range.end.toISOString(),
          },
        );
      },
    },
    {
      definition: {
        name: 'propose_lift_block',
        description:
          'Propose lifting an active block so the machine is free again. Use get_availability to find the block id.',
        parameters: {
          type: 'object',
          properties: { blockId: { type: 'string', description: 'Block id' } },
          required: ['blockId'],
        },
      },
      run: async (args) => {
        const blockId = stringArg(args, 'blockId')?.toLowerCase();
        const range = {
          start: deps.now,
          end: new Date(deps.now.getTime() + MAX_CALENDAR_DAYS * DAY_MS),
        };
        const lanes = await availability.fleetCalendar(accountId, range);
        const lane = lanes.find((l) => l.blocks.some((b) => b.id === blockId));
        const block = lane?.blocks.find((b) => b.id === blockId);
        if (!lane || !block) return { error: 'No active upcoming block with that id.' };
        const name =
          lane.unit.label ?? `${lane.unit.model.manufacturer.name} ${lane.unit.model.modelName}`;
        return propose(
          'LIFT_BLOCK',
          `Lift the ${describeReason(block.reason)} block on ${name} from ${block.startAt.toISOString().slice(0, 10)} to ${block.endAt.toISOString().slice(0, 10)}.`,
          { blockId: block.id },
        );
      },
    },
    {
      definition: {
        name: 'propose_listing_price',
        description:
          "Propose a new price per day (rupees) for one of the supplier's listings. Does not change anything until confirmed.",
        parameters: {
          type: 'object',
          properties: {
            listingId: { type: 'string', description: 'Listing id from list_listings' },
            pricePerDay: { type: 'number', description: 'New price per day in rupees' },
          },
          required: ['listingId', 'pricePerDay'],
        },
      },
      run: async (args) => {
        const price = listingPricePerDaySchema.safeParse(numberArg(args, 'pricePerDay'));
        if (!price.success) return { error: 'pricePerDay must be a positive rupee amount.' };
        const listing = await listings.getOwn(accountId, stringArg(args, 'listingId') ?? '');
        return propose(
          'UPDATE_LISTING_PRICE',
          `Change the price of "${listing.title}" from ₹${listing.pricePerDay} to ₹${price.data} per day.`,
          { listingId: listing.id, pricePerDay: price.data },
        );
      },
    },
    {
      definition: {
        name: 'propose_reject_request',
        description: 'Propose rejecting one rental request.',
        parameters: {
          type: 'object',
          properties: { requestId: { type: 'string', description: 'Rental request id' } },
          required: ['requestId'],
        },
      },
      run: (args) => {
        const requestId = stringArg(args, 'requestId');
        if (!requestId) return Promise.resolve({ error: 'requestId is required.' });
        return Promise.resolve(
          propose('REJECT_REQUEST', `Reject rental request ${requestId}.`, { requestId }),
        );
      },
    },
  ];
}

function dayRange(
  from: string | undefined,
  to: string | undefined,
): { start: Date; end: Date } | { error: string } {
  if (!calendarDateSchema.safeParse(from).success || !calendarDateSchema.safeParse(to).success) {
    return { error: 'Dates must be YYYY-MM-DD.' };
  }
  if (to! < from!) return { error: 'The end date is before the start date.' };
  return {
    start: startOfRentalDay(from!),
    end: new Date(startOfRentalDay(to!).getTime() + DAY_MS),
  };
}

function describeReason(reason: BlockReason): string {
  return { MAINTENANCE: 'maintenance', TRANSPORT: 'transport', HELD_BACK: 'held back' }[reason];
}
