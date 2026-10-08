import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { AuthResponse, BookingPageDto, QuotePageDto } from '@ee/contracts';
import { eq, inArray, like } from 'drizzle-orm';
import {
  LISTING_MEDIA_STORAGE,
  type ListingMediaStorage,
} from '../modules/equipment-listings/domain';
import { RentalFlowHarness } from '../modules/rental-requests/testing/rental-flow-test-app';
import {
  accounts,
  equipmentListings,
  listingMedia,
  supplierProfiles,
} from '../platform/database/schema';
import {
  assertNotProduction,
  createDemoData,
  DEMO_ACCOUNTS,
  DEMO_EMAIL_DOMAIN,
  DEMO_PASSWORD,
  demoAccountIds,
  removeDemoData,
} from './demo-hyderabad-data';

describe('demo:hyderabad', () => {
  let h: RentalFlowHarness;

  before(async () => {
    h = await RentalFlowHarness.start();
    // The local database is shared; start from a known state.
    await removeDemoData(h.app);
  });
  after(async () => {
    await removeDemoData(h.app);
    await h.close();
  });

  it('refuses to run in production', () => {
    assert.throws(() => assertNotProduction({ NODE_ENV: 'production' }), /production/);
    assert.doesNotThrow(() => assertNotProduction({ NODE_ENV: 'development' }));
  });

  it('creates every flow stage, is idempotent, and removes everything exactly', async () => {
    const first = await createDemoData(h.app);
    assert.equal(first.created, true);
    const ids = await demoAccountIds(h.db);
    assert.equal(ids.length, 4);

    const login = async (email: string) => {
      const res = await h.request<AuthResponse>('POST', '/auth/login', undefined, {
        email,
        password: DEMO_PASSWORD,
      });
      assert.equal(res.status, 200, `login ${email}`);
      return res.body.accessToken;
    };
    const deccan = await login(DEMO_ACCOUNTS.deccan.email);
    const charminar = await login(DEMO_ACCOUNTS.charminar.email);
    const gachibowli = await login(DEMO_ACCOUNTS.gachibowli.email);
    const kukatpally = await login(DEMO_ACCOUNTS.kukatpally.email);

    const statuses = async (path: string, token: string) =>
      (await h.request<BookingPageDto | QuotePageDto>('GET', path, token)).body.items
        .map((i) => i.status)
        .sort();
    assert.deepEqual(await statuses('/bookings/builder', kukatpally), ['CONFIRMED', 'RETURNED']);
    assert.deepEqual(await statuses('/bookings/builder', gachibowli), ['ON_RENT']);
    assert.deepEqual(await statuses('/bookings/supplier', charminar), ['ON_RENT']);
    assert.ok((await statuses('/quotes/supplier', deccan)).includes('PENDING_APPROVAL'));
    assert.ok((await statuses('/quotes/builder', kukatpally)).includes('SENT'));

    const keys = (
      await h.db
        .select({ key: listingMedia.storageKey })
        .from(listingMedia)
        .innerJoin(equipmentListings, eq(equipmentListings.id, listingMedia.listingId))
        .innerJoin(supplierProfiles, eq(supplierProfiles.id, equipmentListings.supplierProfileId))
        .where(inArray(supplierProfiles.accountId, ids))
    ).map((r) => r.key);
    assert.equal(keys.length, first.photos);
    const storage = h.app.get<ListingMediaStorage>(LISTING_MEDIA_STORAGE);

    const second = await createDemoData(h.app);
    assert.equal(second.created, false);
    assert.deepEqual((await demoAccountIds(h.db)).sort(), [...ids].sort());

    for (const key of keys) assert.ok(await storage.read(key), `photo ${key} stored`);

    const removed = await removeDemoData(h.app);
    assert.equal(removed.accounts, 4);
    assert.equal(removed.photos, first.photos);
    const left = await h.db
      .select({ id: accounts.id })
      .from(accounts)
      .where(like(accounts.email, `%@${DEMO_EMAIL_DOMAIN}`));
    assert.equal(left.length, 0);
    assert.equal(
      (await h.db.select().from(listingMedia).where(inArray(listingMedia.storageKey, keys))).length,
      0,
    );
    for (const key of keys) assert.equal(await storage.read(key), null);
  });
});
