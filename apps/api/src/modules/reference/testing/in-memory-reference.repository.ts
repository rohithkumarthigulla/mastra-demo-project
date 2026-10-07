import type { City, EntityType, ReferenceRepository } from '../domain';

export class InMemoryReferenceRepository implements ReferenceRepository {
  private readonly cities: City[] = [];
  private readonly entityTypes: EntityType[] = [];

  listCities(): Promise<City[]> {
    const sorted = [...this.cities].sort(
      (a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || a.geoId.localeCompare(b.geoId),
    );
    return Promise.resolve(sorted.map((c) => ({ ...c })));
  }

  listEntityTypes(): Promise<EntityType[]> {
    const sorted = [...this.entityTypes].sort((a, b) => (a.code < b.code ? -1 : 1));
    return Promise.resolve(sorted.map((e) => ({ ...e })));
  }

  insertCityIfAbsent(city: City): Promise<boolean> {
    if (this.cities.some((c) => c.geoId === city.geoId)) return Promise.resolve(false);
    this.cities.push({ ...city });
    return Promise.resolve(true);
  }

  insertEntityTypeIfAbsent(entityType: EntityType): Promise<boolean> {
    if (this.entityTypes.some((e) => e.code === entityType.code)) return Promise.resolve(false);
    this.entityTypes.push({ ...entityType });
    return Promise.resolve(true);
  }
}
