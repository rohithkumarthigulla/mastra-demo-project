import { randomUUID } from 'node:crypto';
import {
  SupplierProfileExistsError,
  type SupplierProfile,
  type SupplierProfileRepository,
} from '../domain';

export class InMemorySupplierProfileRepository implements SupplierProfileRepository {
  readonly rows: SupplierProfile[] = [];

  constructor(private readonly now: () => Date = () => new Date()) {}

  async findByAccountId(accountId: string): Promise<SupplierProfile | null> {
    const row = this.rows.find((r) => r.accountId === accountId);
    return row ? { ...row } : null;
  }

  async create(profile: { accountId: string; displayName: string }): Promise<SupplierProfile> {
    if (this.rows.some((r) => r.accountId === profile.accountId)) {
      throw new SupplierProfileExistsError();
    }
    const now = this.now();
    const row = { id: randomUUID(), ...profile, createdAt: now, updatedAt: now };
    this.rows.push(row);
    return { ...row };
  }

  async updateDisplayName(
    accountId: string,
    displayName: string,
    updatedAt: Date,
  ): Promise<SupplierProfile | null> {
    const row = this.rows.find((r) => r.accountId === accountId);
    if (!row) return null;
    Object.assign(row, { displayName, updatedAt });
    return { ...row };
  }
}
