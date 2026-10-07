import { type PipeTransform } from '@nestjs/common';
import type { EquipmentUnitDto, YardDto } from '@ee/contracts';
import { z } from 'zod';
import { UnitNotFoundError, YardNotFoundError, type UnitView, type YardView } from '../domain';

/** A malformed id can never match, so it is a 404 rather than a 400. */
export class YardIdPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    const parsed = z.uuid().safeParse(value);
    if (!parsed.success) throw new YardNotFoundError();
    return parsed.data;
  }
}

export class UnitIdPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    const parsed = z.uuid().safeParse(value);
    if (!parsed.success) throw new UnitNotFoundError();
    return parsed.data;
  }
}

export function toYardDto(view: YardView): YardDto {
  return {
    id: view.id,
    name: view.name,
    city: view.city,
    address: view.address,
    createdAt: view.createdAt.toISOString(),
    updatedAt: view.updatedAt.toISOString(),
  };
}

export function toUnitDto(view: UnitView): EquipmentUnitDto {
  return {
    id: view.id,
    listing: view.listing,
    model: view.model,
    yard: view.yard,
    modelYear: view.modelYear,
    condition: view.condition,
    label: view.label,
    status: view.status,
    identifiers: view.identifiers,
    createdAt: view.createdAt.toISOString(),
    updatedAt: view.updatedAt.toISOString(),
  };
}
