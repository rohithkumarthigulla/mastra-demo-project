import { Inject, Injectable } from '@nestjs/common';
import {
  REFERENCE_REPOSITORY,
  type City,
  type EntityType,
  type ReferenceRepository,
} from '../domain';

@Injectable()
export class ReferenceService {
  constructor(@Inject(REFERENCE_REPOSITORY) private readonly repo: ReferenceRepository) {}

  async getPublicReference(): Promise<{ cities: City[]; entityTypes: EntityType[] }> {
    const [cities, entityTypes] = await Promise.all([
      this.repo.listCities(),
      this.repo.listEntityTypes(),
    ]);
    return { cities, entityTypes };
  }

  insertCityIfAbsent(city: City): Promise<boolean> {
    return this.repo.insertCityIfAbsent(city);
  }

  insertEntityTypeIfAbsent(entityType: EntityType): Promise<boolean> {
    return this.repo.insertEntityTypeIfAbsent(entityType);
  }
}
