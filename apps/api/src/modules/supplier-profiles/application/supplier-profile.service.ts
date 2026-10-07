import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '../../../platform/auth';
import {
  SUPPLIER_PROFILE_REPOSITORY,
  SupplierProfileExistsError,
  SupplierProfileNotFoundError,
  type SupplierProfile,
  type SupplierProfileRepository,
} from '../domain';

@Injectable()
export class SupplierProfileService {
  constructor(
    @Inject(SUPPLIER_PROFILE_REPOSITORY) private readonly profiles: SupplierProfileRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async get(accountId: string): Promise<SupplierProfile> {
    const profile = await this.profiles.findByAccountId(accountId);
    if (!profile) throw new SupplierProfileNotFoundError();
    return profile;
  }

  /** The pre-check gives a clean 409; the unique constraint still covers concurrent creates. */
  async create(accountId: string, displayName: string): Promise<SupplierProfile> {
    if (await this.profiles.findByAccountId(accountId)) throw new SupplierProfileExistsError();
    return this.profiles.create({ accountId, displayName });
  }

  async update(accountId: string, displayName: string): Promise<SupplierProfile> {
    const profile = await this.profiles.updateDisplayName(accountId, displayName, this.clock.now());
    if (!profile) throw new SupplierProfileNotFoundError();
    return profile;
  }
}
