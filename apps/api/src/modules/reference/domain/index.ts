export interface City {
  geoId: string;
  name: string;
  state: string;
  enabled: boolean;
}

export interface EntityType {
  code: string;
  name: string;
}

export interface ReferenceRepository {
  /** Ordered by name. */
  listCities(): Promise<City[]>;
  /** Ordered by code. */
  listEntityTypes(): Promise<EntityType[]>;
  /** Inserts unless the `geoId` exists; existing rows are left untouched. Returns whether it inserted. */
  insertCityIfAbsent(city: City): Promise<boolean>;
  /** Inserts unless the `code` exists; existing rows are left untouched. Returns whether it inserted. */
  insertEntityTypeIfAbsent(entityType: EntityType): Promise<boolean>;
}

export const REFERENCE_REPOSITORY = Symbol('REFERENCE_REPOSITORY');
