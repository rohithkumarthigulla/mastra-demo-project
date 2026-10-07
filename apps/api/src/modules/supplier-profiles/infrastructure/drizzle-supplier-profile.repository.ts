import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB, isUniqueViolation, type Database } from '../../../platform/database';
import { supplierProfiles } from '../../../platform/database/schema';
import {
  SupplierProfileExistsError,
  type SupplierProfile,
  type SupplierProfileRepository,
} from '../domain';

@Injectable()
export class DrizzleSupplierProfileRepository implements SupplierProfileRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  async findByAccountId(accountId: string): Promise<SupplierProfile | null> {
    const [row] = await this.db
      .select()
      .from(supplierProfiles)
      .where(eq(supplierProfiles.accountId, accountId))
      .limit(1);
    return row ?? null;
  }

  async create(profile: { accountId: string; displayName: string }): Promise<SupplierProfile> {
    try {
      const [row] = await this.db.insert(supplierProfiles).values(profile).returning();
      return row!;
    } catch (error) {
      if (isUniqueViolation(error)) throw new SupplierProfileExistsError();
      throw error;
    }
  }

  async updateDisplayName(
    accountId: string,
    displayName: string,
    updatedAt: Date,
  ): Promise<SupplierProfile | null> {
    const [row] = await this.db
      .update(supplierProfiles)
      .set({ displayName, updatedAt })
      .where(eq(supplierProfiles.accountId, accountId))
      .returning();
    return row ?? null;
  }
}
