import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  CRANE,
  EXCAVATOR,
  NO_PROFILE,
  RETIRED,
  UNKNOWN_ID,
  closeApp,
  createApp,
} from '../testing/listings-test-app';

afterEach(closeApp);

describe('equipment listings (integration)', () => {
  it('requires a signed-in supplier on every supplier route', async () => {
    const http = await createApp();
    const routes = [
      ['GET', '/supplier/listings'],
      ['POST', '/supplier/listings'],
      ['GET', `/supplier/listings/${UNKNOWN_ID}`],
      ['PATCH', `/supplier/listings/${UNKNOWN_ID}`],
      ['POST', `/supplier/listings/${UNKNOWN_ID}/publish`],
      ['POST', `/supplier/listings/${UNKNOWN_ID}/deactivate`],
    ] as const;
    for (const [method, url] of routes) {
      const signedOut = await http.request(method, url);
      assert.equal(signedOut.statusCode, 401, `${method} ${url}`);
      const builder = await http.request(method, url, http.tokenFor('BUILDER'), {});
      assert.equal(builder.statusCode, 403, `${method} ${url}`);
      assert.equal(builder.json().code, 'forbidden');
    }
  });

  it('requires a supplier profile before creating a listing', async () => {
    const http = await createApp();
    const res = await http.request(
      'POST',
      '/supplier/listings',
      http.tokenFor('SUPPLIER', NO_PROFILE),
      {
        modelId: EXCAVATOR,
        cityGeoId: 'IN-TG-HYD',
        title: 'Excavator',
        description: 'A perfectly fine excavator.',
        location: 'Hyderabad',
        pricePerDay: 100,
      },
    );
    assert.equal(res.statusCode, 409);
    assert.equal(res.json().code, 'supplier_profile_required');
  });

  it('creates a DRAFT that stays private until published, and hides it again on deactivate', async () => {
    const http = await createApp();
    const created = await http.createListing(http.supplierA);
    assert.equal(created.status, 'DRAFT');

    const own = await http.request('GET', '/supplier/listings', http.supplierA);
    assert.equal(own.json().total, 1);
    assert.equal(own.json().items[0].id, created.id);

    assert.equal((await http.request('GET', '/equipment-listings')).json().total, 0);
    assert.equal((await http.request('GET', `/equipment-listings/${created.id}`)).statusCode, 404);

    const published = await http.request(
      'POST',
      `/supplier/listings/${created.id}/publish`,
      http.supplierA,
    );
    assert.equal(published.statusCode, 200);
    assert.equal(published.json().status, 'ACTIVE');

    const publicOne = await http.request('GET', `/equipment-listings/${created.id}`);
    assert.equal(publicOne.statusCode, 200);
    const body = publicOne.json();
    assert.equal(body.pricePerDay, 12500.5);
    assert.deepEqual(body.model, {
      id: EXCAVATOR,
      modelName: 'JS205',
      manufacturer: { id: '20000000-0000-4000-8000-000000000001', name: 'JCB' },
      category: { code: 'EXCAVATOR', displayName: 'Excavator' },
    });
    assert.deepEqual(body.city, { geoId: 'IN-TG-HYD', name: 'Hyderabad' });
    assert.deepEqual(body.supplier, { id: 'p-a', displayName: 'Acme Rentals' });
    assert.deepEqual(body.photos, []);
    assert.equal(body.coverPhotoUrl, null);

    const deactivated = await http.request(
      'POST',
      `/supplier/listings/${created.id}/deactivate`,
      http.supplierA,
    );
    assert.equal(deactivated.json().status, 'INACTIVE');
    assert.equal((await http.request('GET', '/equipment-listings')).json().total, 0);
    assert.equal((await http.request('GET', `/equipment-listings/${created.id}`)).statusCode, 404);

    const republished = await http.request(
      'POST',
      `/supplier/listings/${created.id}/publish`,
      http.supplierA,
    );
    assert.equal(republished.json().status, 'ACTIVE');
  });

  it('rejects status transitions that are not allowed with 409', async () => {
    const http = await createApp();
    const draft = await http.createListing(http.supplierA);
    const deactivateDraft = await http.request(
      'POST',
      `/supplier/listings/${draft.id}/deactivate`,
      http.supplierA,
    );
    assert.equal(deactivateDraft.statusCode, 409);
    assert.equal(deactivateDraft.json().code, 'invalid_listing_transition');

    const active = await http.createPublished(http.supplierA);
    const publishAgain = await http.request(
      'POST',
      `/supplier/listings/${active.id}/publish`,
      http.supplierA,
    );
    assert.equal(publishAgain.statusCode, 409);
  });

  it('validates city, model and price', async () => {
    const http = await createApp();
    const cases: [object, number, string][] = [
      [{ cityGeoId: 'IN-ZZ-NOPE' }, 400, 'invalid_city'],
      [{ cityGeoId: 'IN-XX-OFF' }, 400, 'invalid_city'],
      [{ modelId: UNKNOWN_ID }, 400, 'invalid_model'],
      [{ modelId: RETIRED }, 400, 'invalid_model'],
      [{ pricePerDay: 0 }, 400, 'validation_failed'],
      [{ pricePerDay: 10.123 }, 400, 'validation_failed'],
      [{ pricePerDay: 1_000_000.01 }, 400, 'validation_failed'],
    ];
    for (const [overrides, status, code] of cases) {
      const res = await http.request('POST', '/supplier/listings', http.supplierA, {
        modelId: EXCAVATOR,
        cityGeoId: 'IN-TG-HYD',
        title: 'Excavator',
        description: 'A perfectly fine excavator.',
        location: 'Hyderabad',
        pricePerDay: 100,
        ...overrides,
      });
      assert.equal(res.statusCode, status, JSON.stringify(overrides));
      assert.equal(res.json().code, code, JSON.stringify(overrides));
    }
  });

  it('edits a listing, validating changed city and model', async () => {
    const http = await createApp();
    const listing = await http.createListing(http.supplierA);
    const url = `/supplier/listings/${listing.id}`;

    const res = await http.request('PATCH', url, http.supplierA, {
      title: 'Tata crane',
      modelId: CRANE,
      cityGeoId: 'IN-KA-BLR',
      pricePerDay: 9000,
    });
    assert.equal(res.statusCode, 200, res.body);
    const body = res.json();
    assert.equal(body.title, 'Tata crane');
    assert.equal(body.model.category.code, 'CRANE');
    assert.equal(body.city.geoId, 'IN-KA-BLR');
    assert.equal(body.pricePerDay, 9000);
    assert.equal(body.description, 'Well maintained excavator available for daily hire.');

    const badCity = await http.request('PATCH', url, http.supplierA, { cityGeoId: 'IN-XX-OFF' });
    assert.equal(badCity.json().code, 'invalid_city');
    const empty = await http.request('PATCH', url, http.supplierA, {});
    assert.equal(empty.statusCode, 400);
  });

  it("returns 404 for another supplier's listing on every supplier route", async () => {
    const http = await createApp();
    const listing = await http.createListing(http.supplierA);
    const routes = [
      ['GET', `/supplier/listings/${listing.id}`],
      ['PATCH', `/supplier/listings/${listing.id}`],
      ['POST', `/supplier/listings/${listing.id}/publish`],
      ['POST', `/supplier/listings/${listing.id}/deactivate`],
    ] as const;
    for (const [method, url] of routes) {
      const res = await http.request(method, url, http.supplierB, { title: 'Hijacked' });
      assert.equal(res.statusCode, 404, `${method} ${url}`);
      assert.equal(res.json().code, 'listing_not_found');
    }
    const own = await http.request('GET', '/supplier/listings', http.supplierB);
    assert.equal(own.json().total, 0);
    const stillMine = await http.request('GET', `/supplier/listings/${listing.id}`, http.supplierA);
    assert.equal(stillMine.json().title, 'JCB excavator with operator');
  });

  it('returns 404 for malformed listing ids', async () => {
    const http = await createApp();
    assert.equal((await http.request('GET', '/equipment-listings/not-a-uuid')).statusCode, 404);
    assert.equal(
      (await http.request('GET', '/supplier/listings/not-a-uuid', http.supplierA)).statusCode,
      404,
    );
  });

  it('filters supplier listings by status', async () => {
    const http = await createApp();
    await http.createListing(http.supplierA);
    await http.createPublished(http.supplierA);
    const drafts = await http.request('GET', '/supplier/listings?status=DRAFT', http.supplierA);
    assert.equal(drafts.json().total, 1);
    assert.equal(drafts.json().items[0].status, 'DRAFT');
  });

  it('browses ACTIVE listings with filters, newest first', async () => {
    const http = await createApp();
    const hydExcavator = await http.createPublished(http.supplierA, {
      title: 'Hyderabad excavator',
      pricePerDay: 5000,
    });
    const blrExcavator = await http.createPublished(http.supplierB, {
      title: 'Bengaluru excavator',
      cityGeoId: 'IN-KA-BLR',
      pricePerDay: 8000,
    });
    const hydCrane = await http.createPublished(http.supplierA, {
      title: 'Hyderabad crane',
      modelId: CRANE,
      pricePerDay: 20000,
    });
    await http.createListing(http.supplierA, { title: 'Draft excavator' });

    const ids = async (query: string) => {
      const res = await http.request('GET', `/equipment-listings${query}`);
      assert.equal(res.statusCode, 200, `${query}: ${res.body}`);
      return res.json<{ items: { id: string }[] }>().items.map((item) => item.id);
    };

    assert.deepEqual(await ids(''), [hydCrane.id, blrExcavator.id, hydExcavator.id]);
    assert.deepEqual(await ids('?city=IN-TG-HYD'), [hydCrane.id, hydExcavator.id]);
    assert.deepEqual(await ids('?category=EXCAVATOR'), [blrExcavator.id, hydExcavator.id]);
    assert.deepEqual(await ids(`?modelId=${CRANE}`), [hydCrane.id]);
    assert.deepEqual(await ids('?manufacturer=20000000-0000-4000-8000-000000000002'), [
      hydCrane.id,
    ]);
    assert.deepEqual(await ids('?minPrice=6000&maxPrice=20000'), [hydCrane.id, blrExcavator.id]);
    assert.deepEqual(await ids('?q=CRANE'), [hydCrane.id]);
    assert.deepEqual(await ids('?city=IN-TG-HYD&category=EXCAVATOR'), [hydExcavator.id]);

    const page = await http.request('GET', '/equipment-listings?limit=1&offset=1');
    assert.equal(page.json().total, 3);
    assert.equal(page.json().limit, 1);
    assert.equal(page.json().offset, 1);
    assert.deepEqual(
      page.json<{ items: { id: string }[] }>().items.map((i) => i.id),
      [blrExcavator.id],
    );

    assert.equal((await http.request('GET', '/equipment-listings?limit=101')).statusCode, 400);
    assert.equal(
      (await http.request('GET', '/equipment-listings?minPrice=10&maxPrice=5')).statusCode,
      400,
    );
  });
});
