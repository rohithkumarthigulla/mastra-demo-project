import assert from 'node:assert/strict';
import { after, afterEach, before, describe, it } from 'node:test';
import type { RentalRequestDto, RentalRequestPageDto } from '@ee/contracts';
import { and, eq } from 'drizzle-orm';
import { notifications, quotes } from '../../../platform/database/schema';
import { dateFromToday, RentalFlowHarness } from '../testing/rental-flow-test-app';

describe('rental requests (database)', () => {
  let h: RentalFlowHarness;

  before(async () => {
    h = await RentalFlowHarness.start();
  });
  afterEach(async () => {
    await h.cleanup();
  });
  after(async () => {
    await h?.close();
  });

  const kinds = async (accountId: string) =>
    (await h.db.select().from(notifications).where(eq(notifications.accountId, accountId))).map(
      (n) => n.kind,
    );

  const create = (token: string, listingId: string, start = 2, end = 4) =>
    h.request<RentalRequestDto>('POST', '/rental-requests', token, {
      listingId,
      startDate: dateFromToday(start),
      endDate: dateFromToday(end),
      message: 'Need it for the foundation',
    });

  it('creates a pending request, notifies the supplier and lists it on both sides', async () => {
    const builder = await h.builder();
    const supplier = await h.supplier();
    const listing = await h.listing(supplier);

    const res = await create(builder.token, listing.id);
    assert.equal(res.status, 201);
    assert.equal(res.body.status, 'PENDING');
    assert.equal(res.body.days, 3);
    assert.equal(res.body.builderName, builder.name);
    assert.equal(res.body.supplierName, supplier.name);
    assert.equal(res.body.listing.id, listing.id);
    assert.equal(typeof res.body.listing.city, 'string');
    assert.equal(res.body.latestQuote, null);
    assert.deepEqual(await kinds(supplier.accountId), ['REQUEST_RECEIVED']);

    const mine = await h.request<RentalRequestPageDto>(
      'GET',
      '/rental-requests/mine',
      builder.token,
    );
    assert.deepEqual(
      mine.body.items.map((r) => r.id),
      [res.body.id],
    );
    const incoming = await h.request<RentalRequestPageDto>(
      'GET',
      `/rental-requests/incoming?listingId=${listing.id}`,
      supplier.token,
    );
    assert.equal(incoming.body.total, 1);

    const stranger = await h.supplier('Stranger');
    const other = await h.builder('Other');
    for (const actor of [stranger, other]) {
      const hidden = await h.request('GET', `/rental-requests/${res.body.id}`, actor.token);
      assert.equal(hidden.status, 404);
    }
  });

  it('auto-drafts a hidden quote when the listing has a rate card', async () => {
    const builder = await h.builder();
    const supplier = await h.supplier();
    const listing = await h.listing(supplier, {
      pricePerDay: 10000,
      rateCard: { transportFee: 2500, depositAmount: 20000 },
    });

    const res = await create(builder.token, listing.id);
    assert.equal(res.status, 201);
    assert.equal(res.body.latestQuote, null, 'builder must not see the auto-draft');

    const [draft] = await h.db.select().from(quotes).where(eq(quotes.rentalRequestId, res.body.id));
    assert.equal(draft?.status, 'PENDING_APPROVAL');
    assert.equal(draft?.autoDrafted, true);
    assert.equal(draft?.equipmentUnitId, listing.unitIds[0]);
    // 3 days × 10000 + 2500 transport = 32500; tax 5850; deposit 20000
    assert.equal(Number(draft?.subtotal), 32500);
    assert.equal(Number(draft?.taxAmount), 5850);
    assert.equal(Number(draft?.total), 58350);

    const seen = await h.request<RentalRequestDto>(
      'GET',
      `/rental-requests/${res.body.id}`,
      supplier.token,
    );
    assert.equal(seen.body.latestQuote?.status, 'PENDING_APPROVAL');
  });

  it('rejects inactive listings, overlapping duplicates and fully booked dates', async () => {
    const builder = await h.builder();
    const supplier = await h.supplier();
    const draft = await h.listing(supplier, { status: 'DRAFT' });
    assert.equal((await create(builder.token, draft.id)).status, 404);

    const listing = await h.listing(supplier);
    assert.equal((await create(builder.token, listing.id, 2, 4)).status, 201);
    const dup = await create(builder.token, listing.id, 4, 6);
    assert.equal(dup.status, 409);
    assert.equal((await create(builder.token, listing.id, 5, 6)).status, 201);

    const blocked = await h.listing(supplier);
    const block = await h.request(
      'POST',
      `/availability/units/${blocked.unitIds[0]}/blocks`,
      supplier.token,
      {
        reason: 'MAINTENANCE',
        startAt: new Date(Date.parse(`${dateFromToday(1)}T00:00:00+05:30`)).toISOString(),
        endAt: new Date(Date.parse(`${dateFromToday(10)}T00:00:00+05:30`)).toISOString(),
      },
    );
    assert.equal(block.status, 201);
    const busy = await create(builder.token, blocked.id);
    assert.equal(busy.status, 409);
  });

  it('lets the builder cancel and the supplier reject only pending requests', async () => {
    const builder = await h.builder();
    const supplier = await h.supplier();
    const listing = await h.listing(supplier, { rateCard: {} });

    const a = (await create(builder.token, listing.id, 2, 3)).body;
    const cancelled = await h.request<RentalRequestDto>(
      'POST',
      `/rental-requests/${a.id}/cancel`,
      builder.token,
    );
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.status, 'CANCELLED');
    const [expired] = await h.db.select().from(quotes).where(eq(quotes.rentalRequestId, a.id));
    assert.equal(expired?.status, 'EXPIRED');
    assert.equal(
      (await h.request('POST', `/rental-requests/${a.id}/cancel`, builder.token)).status,
      409,
    );
    assert.equal(
      (await h.request('POST', `/rental-requests/${a.id}/reject`, supplier.token, {})).status,
      409,
    );

    const b = (await create(builder.token, listing.id, 5, 6)).body;
    const rejected = await h.request<RentalRequestDto>(
      'POST',
      `/rental-requests/${b.id}/reject`,
      supplier.token,
      { reason: 'Machine is reserved' },
    );
    assert.equal(rejected.status, 200);
    assert.equal(rejected.body.status, 'REJECTED');
    assert.equal(rejected.body.declineReason, 'Machine is reserved');
    assert.deepEqual(await kinds(builder.accountId), ['REQUEST_DECLINED']);
    assert.ok((await kinds(supplier.accountId)).includes('REQUEST_WITHDRAWN'));
  });

  it('records the first supplier view once', async () => {
    const builder = await h.builder();
    const supplier = await h.supplier();
    const listing = await h.listing(supplier);
    const req = (await create(builder.token, listing.id)).body;

    const first = await h.request<RentalRequestDto>(
      'POST',
      `/rental-requests/${req.id}/viewed`,
      supplier.token,
    );
    assert.equal(first.status, 200);
    assert.ok(first.body.viewedAt);
    const second = await h.request<RentalRequestDto>(
      'POST',
      `/rental-requests/${req.id}/viewed`,
      supplier.token,
    );
    assert.equal(second.body.viewedAt, first.body.viewedAt);
    const viewed = await h.db
      .select()
      .from(notifications)
      .where(
        and(eq(notifications.accountId, builder.accountId), eq(notifications.kind, 'JOB_VIEWED')),
      );
    assert.equal(viewed.length, 1);
  });
});
