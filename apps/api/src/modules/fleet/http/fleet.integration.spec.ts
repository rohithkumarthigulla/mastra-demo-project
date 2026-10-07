import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  LISTING_A,
  LISTING_A2,
  LISTING_B,
  NO_PROFILE,
  UNKNOWN_ID,
  closeFleetApp,
  createFleetApp,
} from '../testing/fleet-test-app';

afterEach(closeFleetApp);

describe('fleet (integration)', () => {
  it('requires a signed-in supplier on every fleet route', async () => {
    const http = await createFleetApp();
    const routes = [
      ['GET', '/fleet/yards'],
      ['POST', '/fleet/yards'],
      ['PATCH', `/fleet/yards/${UNKNOWN_ID}`],
      ['DELETE', `/fleet/yards/${UNKNOWN_ID}`],
      ['GET', '/fleet/units'],
      ['POST', '/fleet/units'],
      ['GET', `/fleet/units/${UNKNOWN_ID}`],
      ['PATCH', `/fleet/units/${UNKNOWN_ID}`],
      ['POST', `/fleet/units/${UNKNOWN_ID}/retire`],
    ] as const;
    for (const [method, url] of routes) {
      const signedOut = await http.request(method, url);
      assert.equal(signedOut.statusCode, 401, `${method} ${url}`);
      const builder = await http.request(method, url, http.tokenFor('BUILDER'), {});
      assert.equal(builder.statusCode, 403, `${method} ${url}`);
    }
  });

  it('requires a supplier profile', async () => {
    const http = await createFleetApp();
    const res = await http.request('GET', '/fleet/yards', http.tokenFor('SUPPLIER', NO_PROFILE));
    assert.equal(res.statusCode, 409);
    assert.equal(res.json().code, 'supplier_profile_required');
  });

  it('runs the supplier flow: yard, unit with identifiers, edit, retire', async () => {
    const http = await createFleetApp();
    const yard = await http.createYard(http.supplierA);

    const created = await http.request('POST', '/fleet/units', http.supplierA, {
      listingId: LISTING_A,
      yardId: yard.id,
      modelYear: 2021,
      condition: 'GOOD',
      label: 'Unit 1',
      identifiers: [
        { type: 'REGISTRATION_NUMBER', value: 'TS09AB1234' },
        { type: 'SERIAL_NUMBER', value: 'SN-001' },
      ],
    });
    assert.equal(created.statusCode, 201, created.body);
    const unit = created.json();
    assert.equal(unit.status, 'ACTIVE');
    assert.deepEqual(unit.listing, { id: LISTING_A, title: 'JCB excavator' });
    assert.equal(unit.model.modelName, 'JS205');
    assert.equal(unit.model.manufacturer.name, 'JCB');
    assert.deepEqual(unit.yard, {
      id: yard.id,
      name: 'Main yard',
      city: { geoId: 'IN-TG-HYD', name: 'Hyderabad' },
    });
    assert.deepEqual(unit.identifiers, [
      { type: 'SERIAL_NUMBER', value: 'SN-001' },
      { type: 'REGISTRATION_NUMBER', value: 'TS09AB1234' },
    ]);

    const list = await http.request('GET', `/fleet/units?listingId=${LISTING_A}`, http.supplierA);
    assert.equal(list.statusCode, 200);
    assert.deepEqual(
      list.json().map((u: { id: string }) => u.id),
      [unit.id],
    );

    const edited = await http.request('PATCH', `/fleet/units/${unit.id}`, http.supplierA, {
      condition: 'FAIR',
      label: null,
      identifiers: [{ type: 'ENGINE_NUMBER', value: 'EN-9' }],
    });
    assert.equal(edited.statusCode, 200, edited.body);
    assert.equal(edited.json().condition, 'FAIR');
    assert.equal(edited.json().label, null);
    assert.deepEqual(edited.json().identifiers, [{ type: 'ENGINE_NUMBER', value: 'EN-9' }]);

    const retired = await http.request('POST', `/fleet/units/${unit.id}/retire`, http.supplierA);
    assert.equal(retired.statusCode, 200);
    assert.equal(retired.json().status, 'RETIRED');

    const again = await http.request('POST', `/fleet/units/${unit.id}/retire`, http.supplierA);
    assert.equal(again.statusCode, 409);
    assert.equal(again.json().code, 'unit_retired');

    const editRetired = await http.request('PATCH', `/fleet/units/${unit.id}`, http.supplierA, {
      condition: 'GOOD',
    });
    assert.equal(editRetired.statusCode, 409);
    assert.equal(editRetired.json().code, 'unit_retired');

    const kept = await http.request('GET', `/fleet/units?status=RETIRED`, http.supplierA);
    assert.equal(kept.json().length, 1);
  });

  it('manages yards and keeps names unique per supplier', async () => {
    const http = await createFleetApp();
    const yard = await http.createYard(http.supplierA);

    const dup = await http.request('POST', '/fleet/yards', http.supplierA, {
      name: 'MAIN YARD',
      cityGeoId: 'IN-KA-BLR',
      address: 'Elsewhere',
    });
    assert.equal(dup.statusCode, 409);
    assert.equal(dup.json().code, 'yard_name_taken');

    // Another supplier may reuse the name.
    await http.createYard(http.supplierB);

    const badCity = await http.request('POST', '/fleet/yards', http.supplierA, {
      name: 'North',
      cityGeoId: 'IN-XX-OFF',
      address: 'Somewhere',
    });
    assert.equal(badCity.statusCode, 400);
    assert.equal(badCity.json().code, 'invalid_city');

    const renamed = await http.request('PATCH', `/fleet/yards/${yard.id}`, http.supplierA, {
      name: 'Gachibowli yard',
      cityGeoId: 'IN-KA-BLR',
    });
    assert.equal(renamed.statusCode, 200, renamed.body);
    assert.equal(renamed.json().name, 'Gachibowli yard');
    assert.deepEqual(renamed.json().city, { geoId: 'IN-KA-BLR', name: 'Bengaluru' });

    const list = await http.request('GET', '/fleet/yards', http.supplierA);
    assert.equal(list.json().length, 1);

    const deleted = await http.request('DELETE', `/fleet/yards/${yard.id}`, http.supplierA);
    assert.equal(deleted.statusCode, 204);
    const gone = await http.request('GET', '/fleet/yards', http.supplierA);
    assert.equal(gone.json().length, 0);
  });

  it('refuses to delete a yard that still holds machines', async () => {
    const http = await createFleetApp();
    const yard = await http.createYard(http.supplierA);
    const unit = await http.createUnit(http.supplierA, { listingId: LISTING_A, yardId: yard.id });

    const active = await http.request('DELETE', `/fleet/yards/${yard.id}`, http.supplierA);
    assert.equal(active.statusCode, 409);
    assert.equal(active.json().code, 'yard_has_active_units');

    await http.request('POST', `/fleet/units/${unit.id}/retire`, http.supplierA);
    const retired = await http.request('DELETE', `/fleet/yards/${yard.id}`, http.supplierA);
    assert.equal(retired.statusCode, 409);
    assert.equal(retired.json().code, 'yard_in_use');
  });

  it('keeps identifiers unique per supplier, not globally', async () => {
    const http = await createFleetApp();
    const yardA = await http.createYard(http.supplierA);
    const yardB = await http.createYard(http.supplierB);
    const identifiers = [{ type: 'SERIAL_NUMBER', value: 'SN-42' }];

    await http.createUnit(http.supplierA, { listingId: LISTING_A, yardId: yardA.id, identifiers });

    const dup = await http.request('POST', '/fleet/units', http.supplierA, {
      listingId: LISTING_A2,
      yardId: yardA.id,
      modelYear: 2020,
      condition: 'NEW',
      identifiers: [{ type: 'SERIAL_NUMBER', value: 'sn-42' }],
    });
    assert.equal(dup.statusCode, 409);
    assert.equal(dup.json().code, 'duplicate_identifier');

    // Same value under a different type is fine.
    await http.createUnit(http.supplierA, {
      listingId: LISTING_A2,
      yardId: yardA.id,
      identifiers: [{ type: 'ENGINE_NUMBER', value: 'SN-42' }],
    });

    // Another supplier may hold the same identifier.
    await http.createUnit(http.supplierB, { listingId: LISTING_B, yardId: yardB.id, identifiers });

    const twice = await http.request('POST', '/fleet/units', http.supplierA, {
      listingId: LISTING_A,
      yardId: yardA.id,
      modelYear: 2020,
      condition: 'NEW',
      identifiers: [
        { type: 'SERIAL_NUMBER', value: 'X' },
        { type: 'SERIAL_NUMBER', value: 'Y' },
      ],
    });
    assert.equal(twice.statusCode, 400);
  });

  it("isolates suppliers from each other's yards, units and listings", async () => {
    const http = await createFleetApp();
    const yardA = await http.createYard(http.supplierA);
    const yardB = await http.createYard(http.supplierB);
    const unitA = await http.createUnit(http.supplierA, { listingId: LISTING_A, yardId: yardA.id });

    const b = http.supplierB;
    for (const [method, url, body] of [
      ['GET', `/fleet/units/${unitA.id}`, undefined],
      ['PATCH', `/fleet/units/${unitA.id}`, { condition: 'POOR' }],
      ['POST', `/fleet/units/${unitA.id}/retire`, undefined],
      ['PATCH', `/fleet/yards/${yardA.id}`, { name: 'Mine now' }],
      ['DELETE', `/fleet/yards/${yardA.id}`, undefined],
    ] as const) {
      const res = await http.request(method, url, b, body);
      assert.equal(res.statusCode, 404, `${method} ${url}`);
    }
    assert.equal((await http.request('GET', '/fleet/units', b)).json().length, 0);
    assert.equal((await http.request('GET', '/fleet/yards', b)).json().length, 1);

    const foreignListing = await http.request('POST', '/fleet/units', b, {
      listingId: LISTING_A,
      yardId: yardB.id,
      modelYear: 2020,
      condition: 'NEW',
    });
    assert.equal(foreignListing.statusCode, 404);
    assert.equal(foreignListing.json().code, 'listing_not_found');

    const foreignYard = await http.request('POST', '/fleet/units', b, {
      listingId: LISTING_B,
      yardId: yardA.id,
      modelYear: 2020,
      condition: 'NEW',
    });
    assert.equal(foreignYard.statusCode, 404);
    assert.equal(foreignYard.json().code, 'yard_not_found');

    const moveToForeignYard = await http.request(
      'PATCH',
      `/fleet/units/${unitA.id}`,
      http.supplierA,
      { yardId: yardB.id },
    );
    assert.equal(moveToForeignYard.statusCode, 404);
    assert.equal(moveToForeignYard.json().code, 'yard_not_found');
  });

  it('answers 404 for malformed ids', async () => {
    const http = await createFleetApp();
    const res = await http.request('GET', '/fleet/units/not-a-uuid', http.supplierA);
    assert.equal(res.statusCode, 404);
    assert.equal(res.json().code, 'unit_not_found');
  });
});
