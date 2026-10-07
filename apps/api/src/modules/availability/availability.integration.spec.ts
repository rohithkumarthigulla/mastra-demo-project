import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { LISTING_A, LISTING_A2, UNKNOWN_ID } from '../fleet/testing/fleet-test-app';
import { closeAvailabilityApp, createAvailabilityApp } from './testing/availability-test-app';

const T = (time: string) => `2026-02-01T${time}:00.000Z`;
const RANGE = `from=${T('00:00')}&to=2026-02-02T00:00:00.000Z`;

describe('availability', () => {
  afterEach(closeAvailabilityApp);

  it('requires a signed-in supplier for supplier routes', async () => {
    const http = await createAvailabilityApp();
    assert.equal((await http.request('GET', `/availability/fleet?${RANGE}`)).statusCode, 401);
    const builder = http.tokenFor('BUILDER');
    assert.equal(
      (await http.request('GET', `/availability/fleet?${RANGE}`, builder)).statusCode,
      403,
    );
  });

  it('creates a block and shows it on the unit and fleet calendars', async () => {
    const http = await createAvailabilityApp();
    const unit = await http.createActiveUnit();
    const res = await http.request(
      'POST',
      `/availability/units/${unit.id}/blocks`,
      http.supplierA,
      {
        reason: 'TRANSPORT',
        startAt: '2026-02-01T15:30:00+05:30',
        endAt: '2026-02-01T18:30:00+05:30',
        note: 'Moving to Bengaluru',
      },
    );
    assert.equal(res.statusCode, 201, res.body);
    const block = res.json();
    assert.equal(block.status, 'ACTIVE');
    assert.equal(block.startAt, T('10:00'));
    assert.equal(block.endAt, T('13:00'));

    const cal = await http.request(
      'GET',
      `/availability/units/${unit.id}?${RANGE}`,
      http.supplierA,
    );
    assert.equal(cal.statusCode, 200, cal.body);
    assert.deepEqual(cal.json().slots, [
      {
        state: 'BLOCKED',
        startAt: T('10:00'),
        endAt: T('13:00'),
        source: { type: 'BLOCK', id: block.id },
        reason: 'TRANSPORT',
        note: 'Moving to Bengaluru',
      },
    ]);

    const other = await http.createActiveUnit();
    const fleet = (
      await http.request('GET', `/availability/fleet?${RANGE}`, http.supplierA)
    ).json();
    assert.equal(fleet.lanes.length, 2);
    const lanes = new Map(fleet.lanes.map((l: { unitId: string }) => [l.unitId, l]));
    assert.equal((lanes.get(unit.id) as { slots: unknown[] }).slots.length, 1);
    assert.equal((lanes.get(other.id) as { slots: unknown[] }).slots.length, 0);
  });

  it('returns blocks with their real times when they cross the range edge', async () => {
    const http = await createAvailabilityApp();
    const unit = await http.createActiveUnit();
    assert.equal(
      (await http.block(unit.id, T('20:00'), '2026-02-03T08:00:00.000Z')).statusCode,
      201,
    );
    const cal = await http.request(
      'GET',
      `/availability/units/${unit.id}?${RANGE}`,
      http.supplierA,
    );
    assert.equal(cal.json().slots[0].endAt, '2026-02-03T08:00:00.000Z');
  });

  it('rejects overlapping blocks but allows touching ones', async () => {
    const http = await createAvailabilityApp();
    const unit = await http.createActiveUnit();
    assert.equal((await http.block(unit.id, T('08:00'), T('10:00'))).statusCode, 201);

    const overlap = await http.block(unit.id, T('09:00'), T('11:00'));
    assert.equal(overlap.statusCode, 409);
    assert.equal(overlap.json().code, 'block_overlap');

    assert.equal((await http.block(unit.id, T('10:00'), T('12:00'))).statusCode, 201);
    assert.equal((await http.block(unit.id, T('06:00'), T('08:00'))).statusCode, 201);

    const other = await http.createActiveUnit();
    assert.equal((await http.block(other.id, T('09:00'), T('11:00'))).statusCode, 201);
  });

  it('lets exactly one of two simultaneous overlapping blocks win', async () => {
    const http = await createAvailabilityApp();
    const unit = await http.createActiveUnit();
    const results = await Promise.all([
      http.block(unit.id, T('08:00'), T('12:00')),
      http.block(unit.id, T('10:00'), T('14:00')),
    ]);
    assert.deepEqual(results.map((r) => r.statusCode).sort(), [201, 409]);
    assert.equal(http.blocks.blocks.length, 1);
  });

  it('validates block requests', async () => {
    const http = await createAvailabilityApp();
    const unit = await http.createActiveUnit();
    assert.equal((await http.block(unit.id, T('10:00'), T('10:00'))).statusCode, 400);
    assert.equal((await http.block(unit.id, T('10:00'), T('09:00'))).statusCode, 400);

    const past = await http.block(unit.id, '2025-12-31T00:00:00.000Z', T('10:00'));
    assert.equal(past.statusCode, 400);
    assert.equal(past.json().code, 'block_in_past');

    const note = await http.request(
      'POST',
      `/availability/units/${unit.id}/blocks`,
      http.supplierA,
      {
        reason: 'MAINTENANCE',
        startAt: T('10:00'),
        endAt: T('11:00'),
        note: 'x'.repeat(501),
      },
    );
    assert.equal(note.statusCode, 400);
  });

  it('lifts a block, keeps it for history and frees the time', async () => {
    const http = await createAvailabilityApp();
    const unit = await http.createActiveUnit();
    const block = (await http.block(unit.id, T('08:00'), T('10:00'))).json();

    const lifted = await http.request('DELETE', `/availability/blocks/${block.id}`, http.supplierA);
    assert.equal(lifted.statusCode, 200, lifted.body);
    assert.equal(lifted.json().status, 'LIFTED');
    assert.equal(http.blocks.blocks.length, 1);

    const again = await http.request('DELETE', `/availability/blocks/${block.id}`, http.supplierA);
    assert.equal(again.statusCode, 409);
    assert.equal(again.json().code, 'block_already_lifted');

    const cal = await http.request(
      'GET',
      `/availability/units/${unit.id}?${RANGE}`,
      http.supplierA,
    );
    assert.deepEqual(cal.json().slots, []);
    assert.equal((await http.block(unit.id, T('08:00'), T('10:00'))).statusCode, 201);
  });

  it('refuses to block a retired machine', async () => {
    const http = await createAvailabilityApp();
    const unit = await http.createActiveUnit();
    await http.request('POST', `/fleet/units/${unit.id}/retire`, http.supplierA);
    const res = await http.block(unit.id, T('08:00'), T('10:00'));
    assert.equal(res.statusCode, 409);
    assert.equal(res.json().code, 'unit_retired');

    const fleet = (
      await http.request('GET', `/availability/fleet?${RANGE}`, http.supplierA)
    ).json();
    assert.deepEqual(fleet.lanes, []);
  });

  it("hides other suppliers' machines and blocks", async () => {
    const http = await createAvailabilityApp();
    const unit = await http.createActiveUnit();
    const block = (await http.block(unit.id, T('08:00'), T('10:00'))).json();

    const b = http.supplierB;
    const create = await http.block(unit.id, T('12:00'), T('13:00'), b);
    assert.equal(create.statusCode, 404);
    assert.equal(create.json().code, 'unit_not_found');
    const cal = await http.request('GET', `/availability/units/${unit.id}?${RANGE}`, b);
    assert.equal(cal.statusCode, 404);
    const lift = await http.request('DELETE', `/availability/blocks/${block.id}`, b);
    assert.equal(lift.statusCode, 404);
    assert.equal(lift.json().code, 'block_not_found');
    const fleet = (await http.request('GET', `/availability/fleet?${RANGE}`, b)).json();
    assert.deepEqual(fleet.lanes, []);

    assert.equal(
      (await http.request('DELETE', '/availability/blocks/not-a-uuid', http.supplierA)).statusCode,
      404,
    );
    assert.equal(
      (await http.request('DELETE', `/availability/blocks/${UNKNOWN_ID}`, http.supplierA))
        .statusCode,
      404,
    );
  });

  it('validates the calendar range', async () => {
    const http = await createAvailabilityApp();
    const unit = await http.createActiveUnit();
    const get = (query: string) =>
      http.request('GET', `/availability/units/${unit.id}?${query}`, http.supplierA);
    assert.equal((await get('')).statusCode, 400);
    assert.equal((await get(`from=${T('10:00')}&to=${T('09:00')}`)).statusCode, 400);
    // Feb 1 → May 4 is exactly 92 days.
    assert.equal((await get('from=2026-02-01T00:00:00Z&to=2026-05-04T00:00:01Z')).statusCode, 400);
    assert.equal((await get('from=2026-02-01T00:00:00Z&to=2026-05-04T00:00:00Z')).statusCode, 200);
  });

  describe('public listing availability', () => {
    it('counts available machines without sign-in', async () => {
      const http = await createAvailabilityApp();
      const [u1, u2] = [await http.createActiveUnit(), await http.createActiveUnit()];
      const u3 = await http.createActiveUnit();
      await http.createActiveUnit(http.supplierA, LISTING_A2);
      await http.request('POST', `/fleet/units/${u3.id}/retire`, http.supplierA);
      await http.block(u1.id, T('08:00'), T('10:00'));
      await http.block(u2.id, T('12:00'), T('14:00'));

      const get = (from: string, to: string) =>
        http.request('GET', `/equipment-listings/${LISTING_A}/availability?from=${from}&to=${to}`);

      const busy = await get(T('09:00'), T('13:00'));
      assert.equal(busy.statusCode, 200, busy.body);
      assert.deepEqual(busy.json(), { totalUnits: 2, availableUnits: 0 });
      assert.deepEqual((await get(T('09:00'), T('11:00'))).json(), {
        totalUnits: 2,
        availableUnits: 1,
      });
      assert.deepEqual((await get(T('10:00'), T('12:00'))).json(), {
        totalUnits: 2,
        availableUnits: 2,
      });
    });

    it('hides listings that are not public', async () => {
      const http = await createAvailabilityApp();
      const range = `from=${T('09:00')}&to=${T('13:00')}`;
      for (const id of [LISTING_A2, UNKNOWN_ID, 'not-a-uuid']) {
        const res = await http.request('GET', `/equipment-listings/${id}/availability?${range}`);
        assert.equal(res.statusCode, 404);
        assert.equal(res.json().code, 'listing_not_found');
      }
      assert.equal(
        (await http.request('GET', `/equipment-listings/${LISTING_A}/availability`)).statusCode,
        400,
      );
    });
  });
});
