import { Inject, Injectable } from '@nestjs/common';
import { asc, sql } from 'drizzle-orm';
import { DB, type Database } from '../../../platform/database';
import { cities, entityTypes } from '../../../platform/database/schema';
import type { City, EntityType, ReferenceRepository } from '../domain';

@Injectable()
export class DrizzleReferenceRepository implements ReferenceRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  listCities(): Promise<City[]> {
    return this.db
      .select({
        geoId: cities.geoId,
        name: cities.name,
        state: cities.state,
        enabled: cities.enabled,
      })
      .from(cities)
      .orderBy(sql`lower(${cities.name})`, asc(cities.geoId));
  }

  listEntityTypes(): Promise<EntityType[]> {
    return this.db
      .select({ code: entityTypes.code, name: entityTypes.name })
      .from(entityTypes)
      .orderBy(asc(entityTypes.code));
  }

  async insertCityIfAbsent(city: City): Promise<boolean> {
    const rows = await this.db
      .insert(cities)
      .values(city)
      .onConflictDoNothing({ target: cities.geoId })
      .returning({ geoId: cities.geoId });
    return rows.length > 0;
  }

  async insertEntityTypeIfAbsent(entityType: EntityType): Promise<boolean> {
    const rows = await this.db
      .insert(entityTypes)
      .values(entityType)
      .onConflictDoNothing({ target: entityTypes.code })
      .returning({ code: entityTypes.code });
    return rows.length > 0;
  }
}
