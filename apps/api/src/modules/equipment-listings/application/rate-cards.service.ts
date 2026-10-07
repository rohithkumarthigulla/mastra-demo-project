import { Inject, Injectable } from '@nestjs/common';
import type { PutRateCardRequest, RateCardDto } from '@ee/contracts';
import { and, eq } from 'drizzle-orm';
import { CLOCK, type Clock } from '../../../platform/auth';
import { DB, type Database } from '../../../platform/database';
import { equipmentListings, rateCards, supplierProfiles } from '../../../platform/database/schema';
import { readNumeric, toNumericString } from '../../../platform/money';
import { ListingNotFoundError } from '../domain';

const AMOUNTS = [
  'weekRate',
  'monthRate',
  'transportFee',
  'operatorRatePerDay',
  'depositAmount',
] as const;

type RateCardRow = typeof rateCards.$inferSelect;

function toDto(listingId: string, row: RateCardRow | undefined): RateCardDto {
  return {
    listingId,
    weekRate: readNumeric(row?.weekRate ?? null),
    monthRate: readNumeric(row?.monthRate ?? null),
    transportFee: readNumeric(row?.transportFee ?? null),
    operatorRatePerDay: readNumeric(row?.operatorRatePerDay ?? null),
    depositAmount: readNumeric(row?.depositAmount ?? null),
    updatedAt: row ? row.updatedAt.toISOString() : null,
  };
}

/** One rate card per listing, readable and writable only by the listing's supplier. */
@Injectable()
export class RateCardsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async get(accountId: string, listingId: string): Promise<RateCardDto> {
    await this.requireOwnListing(accountId, listingId);
    const [row] = await this.db
      .select()
      .from(rateCards)
      .where(eq(rateCards.listingId, listingId))
      .limit(1);
    return toDto(listingId, row);
  }

  /** Replaces the whole card; omitted amounts are not allowed, `null` clears one. */
  async put(accountId: string, listingId: string, body: PutRateCardRequest): Promise<RateCardDto> {
    await this.requireOwnListing(accountId, listingId);
    const now = this.clock.now();
    const amounts = Object.fromEntries(
      AMOUNTS.map((key) => {
        const value = body[key];
        return [key, value === null ? null : toNumericString(value)];
      }),
    ) as Record<(typeof AMOUNTS)[number], string | null>;
    const [row] = await this.db
      .insert(rateCards)
      .values({ listingId, ...amounts, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({ target: rateCards.listingId, set: { ...amounts, updatedAt: now } })
      .returning();
    return toDto(listingId, row);
  }

  private async requireOwnListing(accountId: string, listingId: string): Promise<void> {
    const [listing] = await this.db
      .select({ id: equipmentListings.id })
      .from(equipmentListings)
      .innerJoin(supplierProfiles, eq(supplierProfiles.id, equipmentListings.supplierProfileId))
      .where(and(eq(equipmentListings.id, listingId), eq(supplierProfiles.accountId, accountId)))
      .limit(1);
    if (!listing) throw new ListingNotFoundError();
  }
}
