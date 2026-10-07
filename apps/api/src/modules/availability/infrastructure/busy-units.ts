import { ACTIVE_BOOKING_STATUSES } from '@ee/contracts';
import { and, eq, gt, inArray, lt } from 'drizzle-orm';
import type { Database } from '../../../platform/database';
import { bookings, equipmentUnits, maintenanceBlocks } from '../../../platform/database/schema';
import type { TimeRange } from '../domain';

/** The app database or an open transaction on it. */
export type Executor = Database | Parameters<Parameters<Database['transaction']>[0]>[0];

/** Units in `unitIds` covered anywhere in `range` by an active block or an active booking. */
export async function busyUnitIds(
  db: Executor,
  unitIds: readonly string[],
  range: TimeRange,
): Promise<Set<string>> {
  if (unitIds.length === 0) return new Set();
  const blocked = await db
    .selectDistinct({ unitId: maintenanceBlocks.unitId })
    .from(maintenanceBlocks)
    .where(
      and(
        inArray(maintenanceBlocks.unitId, [...unitIds]),
        eq(maintenanceBlocks.status, 'ACTIVE'),
        lt(maintenanceBlocks.startAt, range.end),
        gt(maintenanceBlocks.endAt, range.start),
      ),
    );
  const booked = await db
    .selectDistinct({ unitId: bookings.equipmentUnitId })
    .from(bookings)
    .where(
      and(
        inArray(bookings.equipmentUnitId, [...unitIds]),
        inArray(bookings.status, [...ACTIVE_BOOKING_STATUSES]),
        lt(bookings.startAt, range.end),
        gt(bookings.endAt, range.start),
      ),
    );
  return new Set([...blocked, ...booked].map((r) => r.unitId));
}

/** ACTIVE units of `listingId` that are free for the whole of `range`, in a stable order. */
export async function freeUnitIds(
  db: Executor,
  listingId: string,
  range: TimeRange,
): Promise<string[]> {
  const units = await db
    .select({ id: equipmentUnits.id })
    .from(equipmentUnits)
    .where(and(eq(equipmentUnits.listingId, listingId), eq(equipmentUnits.status, 'ACTIVE')))
    .orderBy(equipmentUnits.createdAt, equipmentUnits.id);
  const busy = await busyUnitIds(
    db,
    units.map((u) => u.id),
    range,
  );
  return units.map((u) => u.id).filter((id) => !busy.has(id));
}
