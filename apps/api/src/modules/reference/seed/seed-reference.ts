import type { ReferenceService } from '../application';
import { seedCities, seedEntityTypes } from './reference-data';

export interface ReferenceSeedSummary {
  cities: number;
  entityTypes: number;
}

/** Inserts what is missing by natural key; existing rows (e.g. a city enabled since) are kept. */
export async function seedReference(reference: ReferenceService): Promise<ReferenceSeedSummary> {
  const created: ReferenceSeedSummary = { cities: 0, entityTypes: 0 };
  for (const city of seedCities) {
    if (await reference.insertCityIfAbsent(city)) created.cities++;
  }
  for (const entityType of seedEntityTypes) {
    if (await reference.insertEntityTypeIfAbsent(entityType)) created.entityTypes++;
  }
  return created;
}
