import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { RateCardDto } from '@ee/contracts';
import { RentalFlowHarness } from '../../rental-requests/testing/rental-flow-test-app';

describe('supplier rate cards (database)', () => {
  let h: RentalFlowHarness;

  before(async () => {
    h = await RentalFlowHarness.start();
  });
  after(async () => {
    await h?.close();
  });

  it('returns an empty card, replaces it on PUT, and hides it from other suppliers', async () => {
    const supplier = await h.supplier();
    const stranger = await h.supplier('Stranger');
    const listing = await h.listing(supplier);
    const url = `/supplier/listings/${listing.id}/rate-card`;

    const empty = await h.request<RateCardDto>('GET', url, supplier.token);
    assert.equal(empty.status, 200);
    assert.deepEqual(empty.body, {
      listingId: listing.id,
      weekRate: null,
      monthRate: null,
      transportFee: null,
      operatorRatePerDay: null,
      depositAmount: null,
      updatedAt: null,
    });

    const card = {
      weekRate: 60000,
      monthRate: 200000,
      transportFee: 4500.5,
      operatorRatePerDay: null,
      depositAmount: 25000,
    };
    const put = await h.request<RateCardDto>('PUT', url, supplier.token, card);
    assert.equal(put.status, 200);
    assert.deepEqual(
      { ...put.body, updatedAt: undefined },
      { listingId: listing.id, ...card, updatedAt: undefined },
    );
    assert.ok(put.body.updatedAt);

    const cleared = { ...card, weekRate: null, transportFee: null };
    const replaced = await h.request<RateCardDto>('PUT', url, supplier.token, cleared);
    assert.equal(replaced.body.weekRate, null);
    assert.equal(replaced.body.transportFee, null);
    assert.equal(replaced.body.monthRate, 200000);
    assert.deepEqual(
      (await h.request<RateCardDto>('GET', url, supplier.token)).body,
      replaced.body,
    );

    assert.equal((await h.request('GET', url, stranger.token)).status, 404);
    assert.equal((await h.request('PUT', url, stranger.token, card)).status, 404);
  });
});
