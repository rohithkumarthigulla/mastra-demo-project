import { type PipeTransform } from '@nestjs/common';
import type { CalendarSlotDto, MaintenanceBlockDto, UnitCalendarDto } from '@ee/contracts';
import { z } from 'zod';
import type { UnitCalendar } from '../application';
import { BlockNotFoundError, PublicListingNotFoundError, type BlockView } from '../domain';

/** A malformed id can never match, so it is a 404 rather than a 400. */
export class BlockIdPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    const parsed = z.uuid().safeParse(value);
    if (!parsed.success) throw new BlockNotFoundError();
    return parsed.data;
  }
}

export class PublicListingIdPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    const parsed = z.uuid().safeParse(value);
    if (!parsed.success) throw new PublicListingNotFoundError();
    return parsed.data;
  }
}

export function toBlockDto(block: BlockView): MaintenanceBlockDto {
  return {
    id: block.id,
    unitId: block.unitId,
    reason: block.reason,
    status: block.status,
    startAt: block.startAt.toISOString(),
    endAt: block.endAt.toISOString(),
    note: block.note,
    createdAt: block.createdAt.toISOString(),
    updatedAt: block.updatedAt.toISOString(),
  };
}

function toSlotDto(block: BlockView): CalendarSlotDto {
  return {
    state: 'BLOCKED',
    startAt: block.startAt.toISOString(),
    endAt: block.endAt.toISOString(),
    source: { type: 'BLOCK', id: block.id },
    reason: block.reason,
    note: block.note,
  };
}

export function toUnitCalendarDto(calendar: UnitCalendar): UnitCalendarDto {
  return {
    unitId: calendar.unit.id,
    label: calendar.unit.label,
    yard: { id: calendar.unit.yard.id, name: calendar.unit.yard.name },
    from: calendar.range.start.toISOString(),
    to: calendar.range.end.toISOString(),
    slots: calendar.blocks.map(toSlotDto),
  };
}
