import {
  bookingSchema,
  equipmentUnitSchema,
  fleetCalendarSchema,
  quoteSchema,
  rentalRequestSchema,
} from '@ee/contracts';
import { describe, expect, it } from 'vitest';
import {
  bookingFixture,
  fleetCalendarFixture,
  quoteFixture,
  requestFixture,
  unitFixture,
} from './fixtures';

describe('fixtures', () => {
  it('match the contract schemas', () => {
    expect(rentalRequestSchema.parse(requestFixture())).toBeDefined();
    expect(quoteSchema.parse(quoteFixture())).toBeDefined();
    expect(bookingSchema.parse(bookingFixture())).toBeDefined();
    expect(fleetCalendarSchema.parse(fleetCalendarFixture())).toBeDefined();
    expect(equipmentUnitSchema.parse(unitFixture())).toBeDefined();
  });
});
