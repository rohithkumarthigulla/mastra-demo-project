import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { REQUIREMENT_MAX_SUPPLIERS, todayInRentalZone, type AccountRole } from '@ee/contracts';
import { eq, inArray } from 'drizzle-orm';
import { AppModule } from '../../app.module';
import { TokenService } from '../../platform/auth';
import { parseEnv } from '../../platform/config';
import { DB, type Database } from '../../platform/database';
import {
  accounts,
  cities,
  equipmentCategories,
  equipmentListings,
  equipmentModels,
  equipmentUnits,
  maintenanceBlocks,
  manufacturers,
  notifications,
  quotes,
  rentalRequests,
  requirements,
  supplierProfiles,
  yards,
} from '../../platform/database/schema';
import { configureApp } from '../../platform/http';

// Runs against the shared dev database. Every row is created with a unique tag and removed
// in `after`, so parallel suites on the same database are not affected.
const env = parseEnv({
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://ee:ee@localhost:5432/ee',
  JWT_SECRET: 'test-secret-that-is-at-least-32-chars-long',
});

const tag = randomUUID().slice(0, 8).toUpperCase();

function dateFromToday(days: number): string {
  const date = new Date(`${todayInRentalZone()}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const START = dateFromToday(10);
const END = dateFromToday(12);

describe('requirements (database)', () => {
  let app: NestFastifyApplication;
  let db: Database;
  let tokens: TokenService;
  const accountIds: string[] = [];
  let cityId: string;
  let categoryId: string;
  let modelId: string;
  let builder: string;
  let otherBuilder: string;
  let supplierAccount: string;
  let supplierProfileId: string;
  let yardId: string;
  /** Active listings, each with one unit. */
  const listings: string[] = [];
  let blockedListing: string;
  let inactiveListing: string;

  const cityGeoId = `IN-T${tag}`;
  const categoryCode = `TEST_${tag}`;

  async function account(role: AccountRole): Promise<string> {
    const [row] = await db
      .insert(accounts)
      .values({
        email: `req-${tag}-${accountIds.length}@test.local`,
        passwordHash: 'x',
        displayName: `${role} ${tag}`,
        role,
      })
      .returning({ id: accounts.id });
    accountIds.push(row!.id);
    return row!.id;
  }

  async function listing(status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE', price = 1000) {
    const [row] = await db
      .insert(equipmentListings)
      .values({
        supplierProfileId,
        modelId,
        cityId,
        title: `Listing ${tag} ${price}`,
        description: 'test',
        location: 'test',
        pricePerDay: String(price),
        status,
      })
      .returning({ id: equipmentListings.id });
    const [unit] = await db
      .insert(equipmentUnits)
      .values({ supplierProfileId, listingId: row!.id, yardId, modelYear: 2022, condition: 'GOOD' })
      .returning({ id: equipmentUnits.id });
    return { listingId: row!.id, unitId: unit!.id };
  }

  const tokenFor = (accountId: string, role: AccountRole) =>
    tokens.signAccessToken({ accountId, role }).accessToken;

  function call(method: 'GET' | 'POST' | 'PATCH', url: string, token: string, payload?: object) {
    return app.inject({
      method,
      url,
      headers: { authorization: `Bearer ${token}` },
      ...(payload ? { payload } : {}),
    });
  }

  const asBuilder = (method: 'GET' | 'POST' | 'PATCH', url: string, payload?: object) =>
    call(method, url, tokenFor(builder, 'BUILDER'), payload);

  async function createRequirement(): Promise<string> {
    const res = await asBuilder('POST', '/requirements', {
      title: `Need excavators ${tag}`,
      categoryCode,
      cityGeoId,
      startDate: START,
      endDate: END,
    });
    assert.equal(res.statusCode, 201, res.body);
    return res.json<{ id: string }>().id;
  }

  before(async () => {
    app = await NestFactory.create<NestFastifyApplication>(
      AppModule.forRoot(env),
      new FastifyAdapter(),
      { logger: false },
    );
    await configureApp(app, env);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    db = app.get(DB);
    tokens = app.get(TokenService);

    const [city] = await db
      .insert(cities)
      .values({ geoId: cityGeoId, name: `City ${tag}`, state: 'Test', enabled: true })
      .returning({ id: cities.id });
    cityId = city!.id;
    const [category] = await db
      .insert(equipmentCategories)
      .values({ code: categoryCode, displayName: `Category ${tag}` })
      .returning({ id: equipmentCategories.id });
    categoryId = category!.id;
    const [manufacturer] = await db.select({ id: manufacturers.id }).from(manufacturers).limit(1);
    const [model] = await db
      .insert(equipmentModels)
      .values({ manufacturerId: manufacturer!.id, categoryId, modelName: `Model ${tag}` })
      .returning({ id: equipmentModels.id });
    modelId = model!.id;

    builder = await account('BUILDER');
    otherBuilder = await account('BUILDER');
    supplierAccount = await account('SUPPLIER');
    const [profile] = await db
      .insert(supplierProfiles)
      .values({ accountId: supplierAccount, displayName: `Supplier ${tag}` })
      .returning({ id: supplierProfiles.id });
    supplierProfileId = profile!.id;
    const [yard] = await db
      .insert(yards)
      .values({ supplierProfileId, name: 'Yard', cityId, address: 'test' })
      .returning({ id: yards.id });
    yardId = yard!.id;

    for (let i = 0; i < REQUIREMENT_MAX_SUPPLIERS + 1; i++) {
      listings.push((await listing('ACTIVE', 1000 + i)).listingId);
    }
    const blocked = await listing('ACTIVE', 50);
    blockedListing = blocked.listingId;
    await db.insert(maintenanceBlocks).values({
      unitId: blocked.unitId,
      reason: 'MAINTENANCE',
      startAt: new Date(`${START}T00:00:00+05:30`),
      endAt: new Date(`${END}T00:00:00+05:30`),
      createdBy: supplierAccount,
    });
    inactiveListing = (await listing('INACTIVE')).listingId;
  });

  after(async () => {
    if (db) {
      const allListings = [...listings, blockedListing, inactiveListing].filter(Boolean);
      await db.delete(requirements).where(inArray(requirements.builderAccountId, accountIds));
      if (allListings.length) {
        await db.delete(rentalRequests).where(inArray(rentalRequests.listingId, allListings));
      }
      await db.delete(maintenanceBlocks).where(inArray(maintenanceBlocks.createdBy, accountIds));
      await db.delete(accounts).where(inArray(accounts.id, accountIds));
      if (modelId) await db.delete(equipmentModels).where(eq(equipmentModels.id, modelId));
      if (categoryId) {
        await db.delete(equipmentCategories).where(eq(equipmentCategories.id, categoryId));
      }
      if (cityId) await db.delete(cities).where(eq(cities.id, cityId));
    }
    await app?.close();
  });

  it('creates a DRAFT requirement and lists only the caller’s own', async () => {
    const id = await createRequirement();
    const detail = await asBuilder('GET', `/requirements/${id}`);
    assert.equal(detail.statusCode, 200);
    const body = detail.json();
    assert.equal(body.status, 'DRAFT');
    assert.equal(body.days, 3);
    assert.deepEqual(body.city, { geoId: cityGeoId, name: `City ${tag}` });
    assert.deepEqual(body.invitations, []);

    const list = await asBuilder('GET', '/requirements?status=DRAFT');
    assert.ok(list.json<{ items: { id: string }[] }>().items.some((r) => r.id === id));

    const other = await call('GET', `/requirements/${id}`, tokenFor(otherBuilder, 'BUILDER'));
    assert.equal(other.statusCode, 404);
    const otherList = await call('GET', '/requirements', tokenFor(otherBuilder, 'BUILDER'));
    assert.equal(otherList.json<{ total: number }>().total, 0);
  });

  it('rejects unknown categories and cities', async () => {
    const res = await asBuilder('POST', '/requirements', {
      title: 'Bad refs',
      categoryCode: 'NOPE_NOT_REAL',
      cityGeoId,
      startDate: START,
      endDate: END,
    });
    assert.equal(res.statusCode, 400);
  });

  it('matches active listings with free units, excluding blocked and inactive ones', async () => {
    const id = await createRequirement();
    const res = await asBuilder('GET', `/requirements/${id}/matches?limit=100`);
    assert.equal(res.statusCode, 200, res.body);
    const page = res.json<{
      total: number;
      items: {
        listing: { id: string; pricePerDay: number };
        availableUnits: number;
        alreadyInvited: boolean;
      }[];
    }>();
    const ids = page.items.map((m) => m.listing.id);
    assert.equal(page.total, listings.length);
    assert.deepEqual(new Set(ids), new Set(listings));
    assert.ok(!ids.includes(blockedListing), 'machine under maintenance is not offered');
    assert.ok(!ids.includes(inactiveListing));
    assert.ok(page.items.every((m) => m.availableUnits === 1 && !m.alreadyInvited));
    const prices = page.items.map((m) => m.listing.pricePerDay);
    assert.deepEqual(
      prices,
      [...prices].sort((a, b) => a - b),
      'cheapest first',
    );
  });

  it('sends to three listings, opens the requirement and notifies the supplier', async () => {
    const id = await createRequirement();
    const before = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(eq(notifications.accountId, supplierAccount));

    const res = await asBuilder('POST', `/requirements/${id}/send`, {
      listingIds: listings.slice(0, 3),
      message: 'Please quote',
    });
    assert.equal(res.statusCode, 200, res.body);
    const result = res.json<{ sent: { status: string }[]; skipped: unknown[] }>();
    assert.equal(result.sent.length, 3);
    assert.ok(result.sent.every((i) => i.status === 'PENDING'));
    assert.deepEqual(result.skipped, []);

    const detail = (await asBuilder('GET', `/requirements/${id}`)).json();
    assert.equal(detail.status, 'OPEN');
    assert.ok(detail.sentAt);
    assert.equal(detail.invitationCount, 3);
    assert.equal(detail.invitations.length, 3);

    const inbox = await call(
      'GET',
      '/notifications?limit=100',
      tokenFor(supplierAccount, 'SUPPLIER'),
    );
    assert.equal(inbox.statusCode, 200);
    const page = inbox.json<{
      total: number;
      unreadCount: number;
      items: { kind: string; href: string }[];
    }>();
    assert.equal(page.total, before.length + 3);
    assert.equal(page.items[0]!.kind, 'REQUEST_RECEIVED');
    assert.equal(page.items[0]!.href, '/supplier/pipeline');

    const matches = (await asBuilder('GET', `/requirements/${id}/matches?limit=100`)).json<{
      items: { listing: { id: string }; alreadyInvited: boolean }[];
    }>();
    const invited = matches.items.filter((m) => m.alreadyInvited).map((m) => m.listing.id);
    assert.deepEqual(new Set(invited), new Set(listings.slice(0, 3)));
  });

  it('skips already-invited, inactive and unavailable listings with reasons', async () => {
    const id = await createRequirement();
    await asBuilder('POST', `/requirements/${id}/send`, { listingIds: [listings[0]] });
    const res = await asBuilder('POST', `/requirements/${id}/send`, {
      listingIds: [listings[0], inactiveListing, blockedListing, listings[1]],
    });
    assert.equal(res.statusCode, 200, res.body);
    const result = res.json<{
      sent: { listingId: string }[];
      skipped: { listingId: string; reason: string }[];
    }>();
    assert.deepEqual(
      result.sent.map((i) => i.listingId),
      [listings[1]],
    );
    const reasons = Object.fromEntries(result.skipped.map((s) => [s.listingId, s.reason]));
    assert.deepEqual(reasons, {
      [listings[0]!]: 'ALREADY_INVITED',
      [inactiveListing]: 'NOT_ACTIVE',
      [blockedListing]: 'UNAVAILABLE',
    });
  });

  it('refuses a 26th supplier', async () => {
    const id = await createRequirement();
    const first = await asBuilder('POST', `/requirements/${id}/send`, {
      listingIds: listings.slice(0, REQUIREMENT_MAX_SUPPLIERS),
    });
    assert.equal(first.statusCode, 200, first.body);
    const res = await asBuilder('POST', `/requirements/${id}/send`, {
      listingIds: [listings[REQUIREMENT_MAX_SUPPLIERS]],
    });
    assert.equal(res.statusCode, 409);
    assert.equal(res.json().code, 'supplier_limit_exceeded');
    const detail = (await asBuilder('GET', `/requirements/${id}`)).json();
    assert.equal(detail.invitationCount, REQUIREMENT_MAX_SUPPLIERS);
  });

  it('edits only while DRAFT', async () => {
    const id = await createRequirement();
    const patched = await asBuilder('PATCH', `/requirements/${id}`, {
      quantity: 2,
      budgetPerDay: 4500,
    });
    assert.equal(patched.statusCode, 200, patched.body);
    assert.equal(patched.json().quantity, 2);
    assert.equal(patched.json().budgetPerDay, 4500);

    await asBuilder('POST', `/requirements/${id}/send`, { listingIds: [listings[0]] });
    const locked = await asBuilder('PATCH', `/requirements/${id}`, { quantity: 3 });
    assert.equal(locked.statusCode, 409);
    assert.equal(locked.json().code, 'requirement_not_draft');
  });

  it('cancel withdraws pending invitations, expires open quotes and notifies suppliers', async () => {
    const id = await createRequirement();
    const sent = await asBuilder('POST', `/requirements/${id}/send`, {
      listingIds: listings.slice(0, 2),
    });
    const [first] = sent.json<{ sent: { rentalRequestId: string }[] }>().sent;
    const [quote] = await db
      .insert(quotes)
      .values({
        rentalRequestId: first!.rentalRequestId,
        supplierProfileId,
        status: 'SENT',
        subtotal: '1000',
        taxPercent: '0',
        taxAmount: '0',
        depositAmount: '0',
        total: '1000',
      })
      .returning({ id: quotes.id });

    const res = await asBuilder('POST', `/requirements/${id}/cancel`);
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(res.json().status, 'CANCELLED');

    const detail = (await asBuilder('GET', `/requirements/${id}`)).json();
    assert.ok(detail.invitations.every((i: { status: string }) => i.status === 'WITHDRAWN'));
    const [q] = await db
      .select({ status: quotes.status })
      .from(quotes)
      .where(eq(quotes.id, quote!.id));
    assert.equal(q!.status, 'EXPIRED');

    const inbox = (
      await call('GET', '/notifications?limit=2', tokenFor(supplierAccount, 'SUPPLIER'))
    ).json<{ items: { kind: string }[] }>();
    assert.deepEqual(
      inbox.items.map((n) => n.kind),
      ['REQUEST_WITHDRAWN', 'REQUEST_WITHDRAWN'],
    );

    const again = await asBuilder('POST', `/requirements/${id}/send`, {
      listingIds: [listings[3]],
    });
    assert.equal(again.statusCode, 409);
  });

  it('refuses to cancel an AWARDED requirement', async () => {
    const id = await createRequirement();
    await db.update(requirements).set({ status: 'AWARDED' }).where(eq(requirements.id, id));
    const res = await asBuilder('POST', `/requirements/${id}/cancel`);
    assert.equal(res.statusCode, 409);
    assert.equal(res.json().code, 'requirement_awarded');
  });

  it('denies suppliers', async () => {
    const res = await call('GET', '/requirements', tokenFor(supplierAccount, 'SUPPLIER'));
    assert.equal(res.statusCode, 403);
  });
});
