import assert from 'node:assert/strict';
import { createFleetApp, LISTING_A } from '../../fleet/testing/fleet-test-app';
import { AvailabilityService } from '../application';
import { AVAILABILITY_REPOSITORY } from '../domain';
import { PublicListingAvailabilityController, SupplierAvailabilityController } from '../http';
import { InMemoryAvailabilityRepository } from './in-memory-availability.repository';

export { closeFleetApp as closeAvailabilityApp } from '../../fleet/testing/fleet-test-app';

/** Fleet test app plus the availability controllers, sharing one in-memory fleet. */
export async function createAvailabilityApp() {
  let blocks: InMemoryAvailabilityRepository | undefined;
  const fleet = await createFleetApp({
    controllers: [SupplierAvailabilityController, PublicListingAvailabilityController],
    providers: (repo) => {
      blocks = new InMemoryAvailabilityRepository(repo.activeUnitIdsFor);
      return [AvailabilityService, { provide: AVAILABILITY_REPOSITORY, useValue: blocks }];
    },
  });
  assert.ok(blocks);
  blocks.publicListings.add(LISTING_A);

  async function createActiveUnit(token = fleet.supplierA, listingId = LISTING_A) {
    const yard = await fleet.createYard(token, { name: `Yard ${Math.random()}` });
    return fleet.createUnit(token, { listingId, yardId: yard.id });
  }

  function block(unitId: string, startAt: string, endAt: string, token = fleet.supplierA) {
    return fleet.request('POST', `/availability/units/${unitId}/blocks`, token, {
      reason: 'MAINTENANCE',
      startAt,
      endAt,
    });
  }

  return { ...fleet, blocks, createActiveUnit, block };
}
