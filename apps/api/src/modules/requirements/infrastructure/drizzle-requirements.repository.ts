import { Inject, Injectable } from '@nestjs/common';
import { ACTIVE_BOOKING_STATUSES, type RequirementStatus } from '@ee/contracts';
import { and, asc, count, desc, eq, inArray, isNotNull, notInArray, sql } from 'drizzle-orm';
import { DB, type Database } from '../../../platform/database';
import {
  bookings,
  cities,
  constructionTasks,
  equipmentCategories,
  equipmentListings,
  equipmentModels,
  equipmentUnits,
  listingMedia,
  maintenanceBlocks,
  quotes,
  rentalRequests,
  requirements,
  supplierProfiles,
} from '../../../platform/database/schema';
import { readNumeric, toNumericString } from '../../../platform/money';
import { photoUrl } from '../../equipment-listings/http/dto';
import type { DbExecutor } from '../../notifications/domain';
import type {
  Invitation,
  Page,
  Paging,
  ReferenceCodes,
  Requirement,
  RequirementFields,
  RequirementMatch,
  RequirementsRepository,
  ResolvedReferences,
  SendTarget,
  TimeRange,
  WithdrawnInvitation,
} from '../domain';

/** Quotes that still count as an offer; the rest are final. */
const CLOSED_QUOTE_STATUSES = ['ACCEPTED', 'REJECTED', 'EXPIRED'] as const;

const requirementColumns = {
  id: requirements.id,
  builderAccountId: requirements.builderAccountId,
  status: requirements.status,
  title: requirements.title,
  categoryCode: equipmentCategories.code,
  equipmentModelId: requirements.equipmentModelId,
  constructionTaskCode: constructionTasks.code,
  cityGeoId: cities.geoId,
  cityName: cities.name,
  startDate: requirements.startDate,
  endDate: requirements.endDate,
  quantity: requirements.quantity,
  budgetPerDay: requirements.budgetPerDay,
  notes: requirements.notes,
  sentAt: requirements.sentAt,
  awardedQuoteId: requirements.awardedQuoteId,
  invitationCount: sql<number>`(
    SELECT count(*)::int FROM ${rentalRequests} WHERE ${rentalRequests.requirementId} = ${requirements.id}
  )`,
  createdAt: requirements.createdAt,
  updatedAt: requirements.updatedAt,
};

type RequirementRow = Omit<Requirement, 'city' | 'budgetPerDay'> & {
  cityGeoId: string;
  cityName: string;
  budgetPerDay: string | null;
};

/**
 * Active units on the listing with no active maintenance block and no active booking
 * overlapping `range`.
 */
function availableUnitsSql(range: TimeRange) {
  return sql<number>`(
    SELECT count(*)::int FROM ${equipmentUnits} u
    WHERE u.listing_id = ${equipmentListings.id}
      AND u.status = 'ACTIVE'
      AND NOT EXISTS (
        SELECT 1 FROM ${maintenanceBlocks} b
        WHERE b.unit_id = u.id AND b.status = 'ACTIVE'
          AND b.start_at < ${range.end} AND b.end_at > ${range.start}
      )
      AND NOT EXISTS (
        SELECT 1 FROM ${bookings} k
        WHERE k.equipment_unit_id = u.id
          AND k.status IN (${sql.join(
            ACTIVE_BOOKING_STATUSES.map((s) => sql`${s}`),
            sql`, `,
          )})
          AND k.start_at < ${range.end} AND k.end_at > ${range.start}
      )
  )`;
}

@Injectable()
export class DrizzleRequirementsRepository implements RequirementsRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  transaction<T>(fn: (tx: DbExecutor) => Promise<T>): Promise<T> {
    return this.db.transaction(fn);
  }

  async resolveReferences(codes: ReferenceCodes): Promise<ResolvedReferences> {
    const refs: ResolvedReferences = {};
    if (codes.categoryCode !== undefined) {
      const [row] = await this.db
        .select({ id: equipmentCategories.id })
        .from(equipmentCategories)
        .where(eq(equipmentCategories.code, codes.categoryCode))
        .limit(1);
      refs.categoryId = row?.id ?? null;
    }
    if (codes.equipmentModelId) {
      const [row] = await this.db
        .select({ id: equipmentModels.id, categoryId: equipmentModels.categoryId })
        .from(equipmentModels)
        .where(
          and(eq(equipmentModels.id, codes.equipmentModelId), eq(equipmentModels.status, 'ACTIVE')),
        )
        .limit(1);
      refs.equipmentModel = row ?? null;
    }
    if (codes.constructionTaskCode) {
      const [row] = await this.db
        .select({ id: constructionTasks.id })
        .from(constructionTasks)
        .where(eq(constructionTasks.code, codes.constructionTaskCode))
        .limit(1);
      refs.constructionTaskId = row?.id ?? null;
    }
    if (codes.cityGeoId !== undefined) {
      const [row] = await this.db
        .select({ id: cities.id })
        .from(cities)
        .where(and(eq(cities.geoId, codes.cityGeoId), eq(cities.enabled, true)))
        .limit(1);
      refs.cityId = row?.id ?? null;
    }
    return refs;
  }

  async categoryIdOf(requirementId: string): Promise<string> {
    const [row] = await this.db
      .select({ categoryId: requirements.categoryId })
      .from(requirements)
      .where(eq(requirements.id, requirementId));
    return row!.categoryId;
  }

  async create(builderAccountId: string, fields: RequirementFields, now: Date): Promise<string> {
    const [row] = await this.db
      .insert(requirements)
      .values({
        builderAccountId,
        ...fields,
        budgetPerDay: fields.budgetPerDay === null ? null : toNumericString(fields.budgetPerDay),
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: requirements.id });
    return row!.id;
  }

  async update(id: string, fields: Partial<RequirementFields>, now: Date): Promise<void> {
    await this.db
      .update(requirements)
      .set({ ...toColumns(fields), updatedAt: now })
      .where(eq(requirements.id, id));
  }

  async find(
    builderAccountId: string,
    id: string,
    opts: { tx?: DbExecutor; lock?: boolean } = {},
  ): Promise<Requirement | null> {
    const executor = opts.tx ?? this.db;
    if (opts.lock) {
      // Lock only the requirement row; the joined reference tables need no lock.
      const [locked] = await executor
        .select({ id: requirements.id })
        .from(requirements)
        .where(and(eq(requirements.id, id), eq(requirements.builderAccountId, builderAccountId)))
        .for('update');
      if (!locked) return null;
    }
    const [row] = await this.selectRequirements(executor).where(
      and(eq(requirements.id, id), eq(requirements.builderAccountId, builderAccountId)),
    );
    return row ? toRequirement(row) : null;
  }

  async list(
    builderAccountId: string,
    query: Paging & { status?: RequirementStatus },
  ): Promise<Page<Requirement>> {
    const where = and(
      eq(requirements.builderAccountId, builderAccountId),
      query.status === undefined ? undefined : eq(requirements.status, query.status),
    );
    const [rows, totals] = await Promise.all([
      this.selectRequirements(this.db)
        .where(where)
        .orderBy(desc(requirements.createdAt), desc(requirements.id))
        .limit(query.limit)
        .offset(query.offset),
      this.db.select({ total: count() }).from(requirements).where(where),
    ]);
    return { items: rows.map(toRequirement), total: totals[0]?.total ?? 0 };
  }

  async invitations(requirementId: string, tx: DbExecutor = this.db): Promise<Invitation[]> {
    const rows = await tx
      .select({
        rentalRequestId: rentalRequests.id,
        listingId: rentalRequests.listingId,
        listingTitle: equipmentListings.title,
        supplierName: supplierProfiles.displayName,
        status: rentalRequests.status,
        viewedAt: rentalRequests.viewedAt,
        quoteId: quotes.id,
        quoteStatus: quotes.status,
        quoteTotal: quotes.total,
      })
      .from(rentalRequests)
      .innerJoin(equipmentListings, eq(equipmentListings.id, rentalRequests.listingId))
      .innerJoin(supplierProfiles, eq(supplierProfiles.id, equipmentListings.supplierProfileId))
      // The builder sees the newest quote the supplier has actually sent; drafts and quotes
      // awaiting the supplier's approval stay hidden.
      .leftJoin(
        quotes,
        eq(
          quotes.id,
          sql`(
            SELECT q.id FROM ${quotes} q
            WHERE q.rental_request_id = ${rentalRequests.id}
              AND q.status NOT IN ('DRAFT', 'PENDING_APPROVAL')
            ORDER BY q.created_at DESC, q.id DESC
            LIMIT 1
          )`,
        ),
      )
      .where(eq(rentalRequests.requirementId, requirementId))
      .orderBy(asc(rentalRequests.createdAt), asc(rentalRequests.id));
    return rows.map((row) => ({
      rentalRequestId: row.rentalRequestId,
      listingId: row.listingId,
      listingTitle: row.listingTitle,
      supplierName: row.supplierName,
      status: row.status,
      viewedAt: row.viewedAt,
      quote:
        row.quoteId && row.quoteStatus && row.quoteTotal !== null
          ? { id: row.quoteId, status: row.quoteStatus, total: readNumeric(row.quoteTotal)! }
          : null,
    }));
  }

  async matches(
    requirement: Requirement,
    range: TimeRange,
    paging: Paging,
  ): Promise<Page<RequirementMatch>> {
    const available = availableUnitsSql(range);
    const where = and(
      eq(equipmentListings.status, 'ACTIVE'),
      eq(cities.geoId, requirement.city.geoId),
      eq(equipmentCategories.code, requirement.categoryCode),
      requirement.equipmentModelId === null
        ? undefined
        : eq(equipmentListings.modelId, requirement.equipmentModelId),
      sql`${available} > 0`,
    );
    const [rows, totals] = await Promise.all([
      this.db
        .select({
          id: equipmentListings.id,
          title: equipmentListings.title,
          cityName: cities.name,
          pricePerDay: equipmentListings.pricePerDay,
          supplierName: supplierProfiles.displayName,
          availableUnits: available,
          coverPhotoId: sql<string | null>`(
            SELECT m.id FROM ${listingMedia} m WHERE m.listing_id = ${equipmentListings.id}
            ORDER BY m.position ASC, m.created_at ASC LIMIT 1
          )`,
          alreadyInvited: sql<boolean>`EXISTS (
            SELECT 1 FROM ${rentalRequests} r
            WHERE r.requirement_id = ${requirement.id} AND r.listing_id = ${equipmentListings.id}
          )`,
        })
        .from(equipmentListings)
        .innerJoin(equipmentModels, eq(equipmentModels.id, equipmentListings.modelId))
        .innerJoin(equipmentCategories, eq(equipmentCategories.id, equipmentModels.categoryId))
        .innerJoin(cities, eq(cities.id, equipmentListings.cityId))
        .innerJoin(supplierProfiles, eq(supplierProfiles.id, equipmentListings.supplierProfileId))
        .where(where)
        .orderBy(asc(equipmentListings.pricePerDay), asc(equipmentListings.id))
        .limit(paging.limit)
        .offset(paging.offset),
      this.db
        .select({ total: count() })
        .from(equipmentListings)
        .innerJoin(equipmentModels, eq(equipmentModels.id, equipmentListings.modelId))
        .innerJoin(equipmentCategories, eq(equipmentCategories.id, equipmentModels.categoryId))
        .innerJoin(cities, eq(cities.id, equipmentListings.cityId))
        .where(where),
    ]);
    return {
      items: rows.map((row) => ({
        listing: {
          id: row.id,
          title: row.title,
          coverPhotoUrl: row.coverPhotoId ? photoUrl(row.id, row.coverPhotoId) : null,
          city: row.cityName,
          pricePerDay: readNumeric(row.pricePerDay)!,
        },
        supplierName: row.supplierName,
        availableUnits: row.availableUnits,
        alreadyInvited: row.alreadyInvited,
      })),
      total: totals[0]?.total ?? 0,
    };
  }

  async invitedListingIds(requirementId: string, tx: DbExecutor): Promise<Set<string>> {
    const rows = await tx
      .select({ listingId: rentalRequests.listingId })
      .from(rentalRequests)
      .where(eq(rentalRequests.requirementId, requirementId));
    return new Set(rows.map((r) => r.listingId));
  }

  async sendTargets(listingIds: string[], range: TimeRange, tx: DbExecutor): Promise<SendTarget[]> {
    return tx
      .select({
        listingId: equipmentListings.id,
        listingTitle: equipmentListings.title,
        listingStatus: equipmentListings.status,
        supplierAccountId: supplierProfiles.accountId,
        supplierName: supplierProfiles.displayName,
        availableUnits: availableUnitsSql(range),
      })
      .from(equipmentListings)
      .innerJoin(supplierProfiles, eq(supplierProfiles.id, equipmentListings.supplierProfileId))
      .where(inArray(equipmentListings.id, listingIds));
  }

  async insertInvitations(
    requirement: Requirement,
    listingIds: string[],
    message: string | null,
    now: Date,
    tx: DbExecutor,
  ): Promise<string[]> {
    if (listingIds.length === 0) return [];
    const rows = await tx
      .insert(rentalRequests)
      .values(
        listingIds.map((listingId) => ({
          listingId,
          builderAccountId: requirement.builderAccountId,
          requirementId: requirement.id,
          startDate: requirement.startDate,
          endDate: requirement.endDate,
          message,
          status: 'PENDING' as const,
          createdAt: now,
          updatedAt: now,
        })),
      )
      .onConflictDoNothing({
        target: [rentalRequests.requirementId, rentalRequests.listingId],
        where: isNotNull(rentalRequests.requirementId),
      })
      .returning({ listingId: rentalRequests.listingId });
    return rows.map((r) => r.listingId);
  }

  async markOpen(id: string, now: Date, tx: DbExecutor): Promise<void> {
    await tx
      .update(requirements)
      .set({ status: 'OPEN', sentAt: now, updatedAt: now })
      .where(eq(requirements.id, id));
  }

  async cancel(id: string, now: Date, tx: DbExecutor): Promise<WithdrawnInvitation[]> {
    await tx
      .update(requirements)
      .set({ status: 'CANCELLED', updatedAt: now })
      .where(eq(requirements.id, id));

    const withdrawn = await tx
      .update(rentalRequests)
      .set({ status: 'WITHDRAWN', updatedAt: now })
      .where(and(eq(rentalRequests.requirementId, id), eq(rentalRequests.status, 'PENDING')))
      .returning({ id: rentalRequests.id, listingId: rentalRequests.listingId });
    if (withdrawn.length === 0) return [];

    const requestIds = withdrawn.map((w) => w.id);
    await tx
      .update(quotes)
      .set({ status: 'EXPIRED', updatedAt: now })
      .where(
        and(
          inArray(quotes.rentalRequestId, requestIds),
          notInArray(quotes.status, [...CLOSED_QUOTE_STATUSES]),
        ),
      );

    const listings = await tx
      .select({
        listingId: equipmentListings.id,
        listingTitle: equipmentListings.title,
        supplierAccountId: supplierProfiles.accountId,
      })
      .from(equipmentListings)
      .innerJoin(supplierProfiles, eq(supplierProfiles.id, equipmentListings.supplierProfileId))
      .where(
        inArray(
          equipmentListings.id,
          withdrawn.map((w) => w.listingId),
        ),
      );
    const byListing = new Map(listings.map((l) => [l.listingId, l]));
    return withdrawn.map((w) => {
      const listing = byListing.get(w.listingId)!;
      return {
        rentalRequestId: w.id,
        listingTitle: listing.listingTitle,
        supplierAccountId: listing.supplierAccountId,
      };
    });
  }

  private selectRequirements(executor: DbExecutor) {
    return executor
      .select(requirementColumns)
      .from(requirements)
      .innerJoin(equipmentCategories, eq(equipmentCategories.id, requirements.categoryId))
      .innerJoin(cities, eq(cities.id, requirements.cityId))
      .leftJoin(constructionTasks, eq(constructionTasks.id, requirements.constructionTaskId));
  }
}

function toColumns(fields: Partial<RequirementFields>) {
  const { budgetPerDay, ...rest } = fields;
  return {
    ...rest,
    ...(budgetPerDay === undefined
      ? {}
      : { budgetPerDay: budgetPerDay === null ? null : toNumericString(budgetPerDay) }),
  };
}

function toRequirement(row: RequirementRow): Requirement {
  return {
    id: row.id,
    builderAccountId: row.builderAccountId,
    status: row.status,
    title: row.title,
    categoryCode: row.categoryCode,
    equipmentModelId: row.equipmentModelId,
    constructionTaskCode: row.constructionTaskCode,
    city: { geoId: row.cityGeoId, name: row.cityName },
    startDate: row.startDate,
    endDate: row.endDate,
    quantity: row.quantity,
    budgetPerDay: readNumeric(row.budgetPerDay),
    notes: row.notes,
    sentAt: row.sentAt,
    awardedQuoteId: row.awardedQuoteId,
    invitationCount: row.invitationCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
