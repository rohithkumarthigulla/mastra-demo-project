import { deflateSync } from 'node:zlib';
import type { INestApplicationContext } from '@nestjs/common';
import { todayInRentalZone, type CalendarDate, type QuoteLineInput } from '@ee/contracts';
import { and, eq, inArray, like } from 'drizzle-orm';
import { AuthService } from '../modules/accounts/application';
import { AvailabilityService } from '../modules/availability/application';
import { BookingsService } from '../modules/bookings/application';
import { EquipmentKnowledgeService } from '../modules/equipment-knowledge/application';
import {
  EquipmentListingsService,
  ListingMediaService,
  RateCardsService,
} from '../modules/equipment-listings/application';
import {
  LISTING_MEDIA_STORAGE,
  type ListingMediaStorage,
} from '../modules/equipment-listings/domain';
import { FleetService } from '../modules/fleet/application';
import { QuotesService } from '../modules/quotes/application';
import { RentalRequestsService } from '../modules/rental-requests/application';
import { RequirementsService } from '../modules/requirements/application';
import { SupplierProfileService } from '../modules/supplier-profiles/application';
import { DB, type Database } from '../platform/database';
import {
  accounts,
  bookings,
  equipmentListings,
  equipmentModels,
  equipmentSpecifications,
  listingMedia,
  maintenanceBlocks,
  manufacturers,
  quotes,
  rentalRequests,
  requirements,
  specificationSources,
  supplierProfiles,
} from '../platform/database/schema';

export const DEMO_EMAIL_DOMAIN = 'demo.equipmentexchange.local';
export const DEMO_PASSWORD = 'DemoPass#2026';
export const DEMO_SOURCE_NAME = 'Demo data (not real manufacturer figures)';
const HYDERABAD = 'IN-HYD';

export const DEMO_ACCOUNTS = {
  deccan: {
    email: `supplier.deccan@${DEMO_EMAIL_DOMAIN}`,
    displayName: 'Deccan Earthmovers',
    role: 'SUPPLIER',
  },
  charminar: {
    email: `supplier.charminar@${DEMO_EMAIL_DOMAIN}`,
    displayName: 'Charminar Cranes & Loaders',
    role: 'SUPPLIER',
  },
  gachibowli: {
    email: `builder.gachibowli@${DEMO_EMAIL_DOMAIN}`,
    displayName: 'Gachibowli Constructions',
    role: 'BUILDER',
  },
  kukatpally: {
    email: `builder.kukatpally@${DEMO_EMAIL_DOMAIN}`,
    displayName: 'Kukatpally Infra',
    role: 'BUILDER',
  },
} as const;

export interface DemoSummary {
  created: boolean;
  listings: number;
  photos: number;
  units: number;
  requests: number;
  bookings: number;
  requirements: number;
}

export interface DemoRemoval {
  accounts: number;
  photos: number;
  specifications: number;
}

export function assertNotProduction(env: { NODE_ENV?: string }): void {
  if (env.NODE_ENV === 'production') {
    throw new Error('Refusing to load demo data: NODE_ENV is "production".');
  }
}

/** Demo rows are found by the account email domain; nothing else is tagged. */
export async function demoAccountIds(db: Database): Promise<string[]> {
  const rows = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(like(accounts.email, `%@${DEMO_EMAIL_DOMAIN}`));
  return rows.map((r) => r.id);
}

/**
 * Creates the Hyderabad demo dataset through the application services, so every row
 * passes the same rules as the api. Does nothing if any demo account already exists.
 * If creation fails part-way, everything created so far is removed again.
 */
export async function createDemoData(app: INestApplicationContext): Promise<DemoSummary> {
  const db = app.get<Database>(DB);
  if ((await demoAccountIds(db)).length > 0) {
    return {
      created: false,
      listings: 0,
      photos: 0,
      units: 0,
      requests: 0,
      bookings: 0,
      requirements: 0,
    };
  }
  try {
    return await build(app, db);
  } catch (error) {
    await removeDemoData(app);
    throw error;
  }
}

/** Deletes every demo row and every demo photo file. Safe to run when nothing exists. */
export async function removeDemoData(app: INestApplicationContext): Promise<DemoRemoval> {
  const db = app.get<Database>(DB);
  const storage = app.get<ListingMediaStorage>(LISTING_MEDIA_STORAGE);
  const ids = await demoAccountIds(db);

  const [source] = await db
    .select({ id: specificationSources.id })
    .from(specificationSources)
    .where(eq(specificationSources.sourceName, DEMO_SOURCE_NAME));

  const profileIds = ids.length
    ? (
        await db
          .select({ id: supplierProfiles.id })
          .from(supplierProfiles)
          .where(inArray(supplierProfiles.accountId, ids))
      ).map((r) => r.id)
    : [];
  const listingIds = profileIds.length
    ? (
        await db
          .select({ id: equipmentListings.id })
          .from(equipmentListings)
          .where(inArray(equipmentListings.supplierProfileId, profileIds))
      ).map((r) => r.id)
    : [];
  const storageKeys = listingIds.length
    ? (
        await db
          .select({ key: listingMedia.storageKey })
          .from(listingMedia)
          .where(inArray(listingMedia.listingId, listingIds))
      ).map((r) => r.key)
    : [];

  let specifications = 0;
  await db.transaction(async (tx) => {
    if (ids.length) {
      await tx.delete(bookings).where(inArray(bookings.builderAccountId, ids));
      if (profileIds.length) {
        await tx.delete(bookings).where(inArray(bookings.supplierProfileId, profileIds));
        await tx.delete(quotes).where(inArray(quotes.supplierProfileId, profileIds));
      }
      if (listingIds.length) {
        await tx.delete(rentalRequests).where(inArray(rentalRequests.listingId, listingIds));
      }
      await tx.delete(rentalRequests).where(inArray(rentalRequests.builderAccountId, ids));
      await tx.delete(requirements).where(inArray(requirements.builderAccountId, ids));
      await tx.delete(maintenanceBlocks).where(inArray(maintenanceBlocks.createdBy, ids));
      await tx.delete(accounts).where(inArray(accounts.id, ids));
    }
    if (source) {
      specifications = (
        await tx
          .delete(equipmentSpecifications)
          .where(eq(equipmentSpecifications.sourceId, source.id))
          .returning({ id: equipmentSpecifications.id })
      ).length;
      await tx.delete(specificationSources).where(eq(specificationSources.id, source.id));
    }
  });
  // Files go only after the rows are gone, so a failed delete never orphans a row.
  for (const key of storageKeys) await storage.remove(key);

  return { accounts: ids.length, photos: storageKeys.length, specifications };
}

async function build(app: INestApplicationContext, db: Database): Promise<DemoSummary> {
  const auth = app.get(AuthService);
  const profiles = app.get(SupplierProfileService);
  const fleet = app.get(FleetService);
  const availability = app.get(AvailabilityService);
  const listings = app.get(EquipmentListingsService);
  const media = app.get(ListingMediaService);
  const rateCards = app.get(RateCardsService);
  const knowledge = app.get(EquipmentKnowledgeService);
  const rentals = app.get(RentalRequestsService);
  const quoteService = app.get(QuotesService);
  const bookingService = app.get(BookingsService);
  const requirementService = app.get(RequirementsService);

  const today = todayInRentalZone();
  const day = (n: number): CalendarDate => addDays(today, n);
  let photos = 0;
  let units = 0;

  // Demo specifications: filled only where the seed left a definition empty.
  const cat320 = await modelId(db, 'Caterpillar', '320');
  const jcb3cx = await modelId(db, 'JCB', '3CX');
  const pc210 = await modelId(db, 'Komatsu', 'PC210');
  const jcb540 = await modelId(db, 'JCB', '540-140');
  const source = await knowledge.createSource({
    sourceType: 'INTERNAL_VERIFICATION',
    sourceName: DEMO_SOURCE_NAME,
    notes: 'Created by demo:hyderabad for local walkthroughs. Not real manufacturer figures.',
  });
  await addSpecIfMissing(knowledge, cat320, {
    definitionCode: 'TRANSPORT_LENGTH',
    numericValue: 9.5,
    unit: 'm',
    sourceId: source.id,
  });
  await addSpecIfMissing(knowledge, jcb3cx, {
    definitionCode: 'MAX_REACH',
    numericValue: 5.8,
    unit: 'm',
    sourceId: source.id,
  });

  const register = async (key: keyof typeof DEMO_ACCOUNTS) => {
    const a = DEMO_ACCOUNTS[key];
    const result = await auth.register({
      email: a.email,
      password: DEMO_PASSWORD,
      displayName: a.displayName,
      role: a.role,
    });
    return result.account.id;
  };

  const supplier = async (key: 'deccan' | 'charminar', yard: { name: string; address: string }) => {
    const accountId = await register(key);
    await profiles.create(accountId, DEMO_ACCOUNTS[key].displayName);
    const { id: yardId } = await fleet.createYard(accountId, { cityGeoId: HYDERABAD, ...yard });
    return { accountId, yardId };
  };

  const listing = async (
    owner: { accountId: string; yardId: string },
    spec: {
      modelId: string;
      title: string;
      description: string;
      location: string;
      pricePerDay: number;
      serialPrefix: string;
      units: number;
      colour: [number, number, number];
    },
  ) => {
    const { id } = await listings.create(owner.accountId, {
      modelId: spec.modelId,
      cityGeoId: HYDERABAD,
      title: spec.title,
      description: spec.description,
      location: spec.location,
      pricePerDay: spec.pricePerDay,
    });
    const unitIds: string[] = [];
    for (let i = 1; i <= spec.units; i++) {
      const unit = await fleet.createUnit(owner.accountId, {
        listingId: id,
        yardId: owner.yardId,
        modelYear: 2019 + i,
        condition: i === 1 ? 'EXCELLENT' : 'GOOD',
        label: `${spec.serialPrefix} #${i}`,
        identifiers: [{ type: 'SERIAL_NUMBER', value: `DEMO-${spec.serialPrefix}-00${i}` }],
      });
      unitIds.push(unit.id);
      units++;
    }
    for (let i = 0; i < 2; i++) {
      const [r, g, b] = spec.colour;
      await media.upload(owner.accountId, id, {
        filename: `${spec.serialPrefix.toLowerCase()}-${i + 1}.png`,
        data: demoPng([r, Math.min(255, g + i * 60), b]),
      });
      photos++;
    }
    await listings.publish(owner.accountId, id);
    return { id, unitIds, pricePerDay: spec.pricePerDay };
  };

  // Suppliers, yards, listings, units, photos.
  const deccan = await supplier('deccan', {
    name: 'Gachibowli Yard',
    address: 'Plot 14, Financial District Road, Gachibowli, Hyderabad 500032',
  });
  const charminar = await supplier('charminar', {
    name: 'Uppal Depot',
    address: 'Survey 221, Uppal Industrial Area, Hyderabad 500039',
  });

  const deccanExcavator = await listing(deccan, {
    modelId: cat320,
    title: 'CAT 320 excavator with operator option',
    description: '20-tonne class tracked excavator for foundations and basement digging.',
    location: 'Gachibowli, Hyderabad',
    pricePerDay: 12000,
    serialPrefix: 'CAT320',
    units: 2,
    colour: [230, 170, 20],
  });
  const deccanBackhoe = await listing(deccan, {
    modelId: jcb3cx,
    title: 'JCB 3CX backhoe loader',
    description: 'Backhoe loader for trenching, loading and site clearing work.',
    location: 'Gachibowli, Hyderabad',
    pricePerDay: 4500,
    serialPrefix: 'JCB3CX',
    units: 2,
    colour: [240, 200, 30],
  });
  const charminarExcavator = await listing(charminar, {
    modelId: pc210,
    title: 'Komatsu PC210 excavator',
    description: 'Reliable 21-tonne excavator, delivered anywhere inside the ORR.',
    location: 'Uppal, Hyderabad',
    pricePerDay: 11000,
    serialPrefix: 'PC210',
    units: 2,
    colour: [40, 120, 200],
  });
  const charminarTelehandler = await listing(charminar, {
    modelId: jcb540,
    title: 'JCB 540-140 telehandler',
    description: 'Telehandler for lifting material to upper floors, 14 m lift height.',
    location: 'Uppal, Hyderabad',
    pricePerDay: 8000,
    serialPrefix: 'JCB540',
    units: 1,
    colour: [60, 160, 90],
  });

  // Only the CAT 320 has a rate card, so requests for it are auto-drafted.
  await rateCards.put(deccan.accountId, deccanExcavator.id, {
    weekRate: 72000,
    monthRate: 270000,
    transportFee: 6000,
    operatorRatePerDay: 1500,
    depositAmount: 25000,
  });

  // A maintenance block on the second backhoe, starting tomorrow for two days.
  await availability.createBlock(deccan.accountId, unitAt(deccanBackhoe, 1), {
    reason: 'MAINTENANCE',
    startAt: `${day(1)}T09:00:00+05:30`,
    endAt: `${day(3)}T09:00:00+05:30`,
    note: 'Hydraulic hose replacement',
  });

  const gachibowli = await register('gachibowli');
  const kukatpally = await register('kukatpally');

  const supplierQuote = async (
    supplierAccountId: string,
    requestId: string,
    unitId: string,
    pricePerDay: number,
    days: number,
  ) => {
    const lines: QuoteLineInput[] = [
      {
        type: 'RENTAL',
        description: `Rental, ${days} days`,
        quantity: days,
        unitAmount: pricePerDay,
      },
      { type: 'TRANSPORT', description: 'Delivery and pickup', quantity: 1, unitAmount: 5000 },
    ];
    const quote = await quoteService.create(supplierAccountId, {
      rentalRequestId: requestId,
      equipmentUnitId: unitId,
      lines,
      notes: 'Diesel by customer. Operator available on request.',
      validUntil: day(7),
    });
    return quoteService.send(supplierAccountId, quote.id);
  };

  const booked = async (
    builderId: string,
    supplierAccountId: string,
    target: { id: string; unitIds: string[]; pricePerDay: number },
    start: number,
    end: number,
  ) => {
    const request = await rentals.create(builderId, {
      listingId: target.id,
      startDate: day(start),
      endDate: day(end),
      message: 'Need it for a residential tower site.',
    });
    const quote = await supplierQuote(
      supplierAccountId,
      request.id,
      unitAt(target, 0),
      target.pricePerDay,
      end - start + 1,
    );
    const accepted = await quoteService.accept(builderId, quote.id);
    if (!accepted.bookingId) throw new Error(`Quote ${quote.id} was accepted without a booking`);
    return accepted.bookingId;
  };

  // (a) New request, no quote yet.
  await rentals.create(gachibowli, {
    listingId: charminarTelehandler.id,
    startDate: day(10),
    endDate: day(14),
    message: 'Lifting blocks to the 6th floor, Gachibowli site.',
  });
  // (b) Request on a rate-card listing: a quote waits for supplier approval.
  await rentals.create(gachibowli, {
    listingId: deccanExcavator.id,
    startDate: day(7),
    endDate: day(16),
    message: 'Basement excavation for a 12-floor tower.',
  });
  // (c) Quote sent, waiting for the builder.
  const quoted = await rentals.create(kukatpally, {
    listingId: charminarExcavator.id,
    startDate: day(20),
    endDate: day(24),
    message: 'Foundation work at our Kukatpally site.',
  });
  await supplierQuote(
    charminar.accountId,
    quoted.id,
    unitAt(charminarExcavator, 0),
    charminarExcavator.pricePerDay,
    5,
  );
  // (d) Accepted: booking confirmed.
  await booked(kukatpally, deccan.accountId, deccanBackhoe, 5, 9);
  // (e) On rent.
  const onRent = await booked(gachibowli, charminar.accountId, charminarExcavator, 1, 6);
  const charminarViewer = { role: 'SUPPLIER', accountId: charminar.accountId } as const;
  await bookingService.transition(charminarViewer, onRent, 'dispatch');
  await bookingService.transition(charminarViewer, onRent, 'start-rent');
  // (f) Returned.
  const returned = await booked(kukatpally, deccan.accountId, deccanBackhoe, 30, 33);
  const supplierViewer = { role: 'SUPPLIER', accountId: deccan.accountId } as const;
  await bookingService.transition(supplierViewer, returned, 'dispatch');
  await bookingService.transition(supplierViewer, returned, 'start-rent');
  await bookingService.transition(supplierViewer, returned, 'complete');

  // A requirement sent to one excavator listing from each supplier.
  const requirement = await requirementService.create(kukatpally, {
    title: 'Excavator for foundation work, Kukatpally',
    categoryCode: 'EXCAVATOR',
    constructionTaskCode: 'FOUNDATION_EXCAVATION',
    cityGeoId: HYDERABAD,
    startDate: day(40),
    endDate: day(45),
    quantity: 1,
    budgetPerDay: 11500,
    notes: 'Black cotton soil, about 4 m deep.',
  });
  await requirementService.send(kukatpally, requirement.id, {
    listingIds: [deccanExcavator.id, charminarExcavator.id],
    message: 'Please quote for six days.',
  });

  return {
    created: true,
    listings: 4,
    photos,
    units,
    requests: 6 + 2,
    bookings: 3,
    requirements: 1,
  };
}

async function modelId(db: Database, manufacturer: string, modelName: string): Promise<string> {
  const [row] = await db
    .select({ id: equipmentModels.id })
    .from(equipmentModels)
    .innerJoin(manufacturers, eq(manufacturers.id, equipmentModels.manufacturerId))
    .where(and(eq(manufacturers.name, manufacturer), eq(equipmentModels.modelName, modelName)));
  if (!row) {
    throw new Error(`Seeded model ${manufacturer} ${modelName} not found. Run pnpm db:seed first.`);
  }
  return row.id;
}

async function addSpecIfMissing(
  knowledge: EquipmentKnowledgeService,
  model: string,
  spec: Parameters<EquipmentKnowledgeService['addSpecification']>[1],
): Promise<void> {
  const detail = await knowledge.getModel(model);
  if (detail.specifications.some((s) => s.definitionCode === spec.definitionCode)) return;
  await knowledge.addSpecification(model, spec);
}

function addDays(date: CalendarDate, days: number): CalendarDate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** A 16×16 single-colour PNG, built in memory so the repo carries no binary files. */
export function demoPng([r, g, b]: [number, number, number]): Buffer {
  const size = 16;
  const row = Buffer.alloc(1 + size * 3);
  for (let x = 0; x < size; x++) row.set([r, g, b], 1 + x * 3);
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8-bit RGB, no interlace
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function unitAt(listing: { unitIds: string[] }, index: number): string {
  const id = listing.unitIds[index];
  if (!id) throw new Error(`Demo listing has no unit ${index + 1}`);
  return id;
}
