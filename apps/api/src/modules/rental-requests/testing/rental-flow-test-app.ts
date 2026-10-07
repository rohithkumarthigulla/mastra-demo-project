import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import type { AccountRole } from '@ee/contracts';
import { eq, inArray } from 'drizzle-orm';
import { AppModule } from '../../../app.module';
import { TokenService } from '../../../platform/auth';
import { parseEnv } from '../../../platform/config';
import { DB, type Database } from '../../../platform/database';
import {
  accounts,
  bookings,
  cities,
  equipmentListings,
  equipmentModels,
  equipmentUnits,
  maintenanceBlocks,
  quotes,
  rateCards,
  rentalRequests,
  requirements,
  supplierProfiles,
  yards,
} from '../../../platform/database/schema';
import { toNumericString } from '../../../platform/money';
import { configureApp } from '../../../platform/http';

/**
 * Boots the real app against the shared local database. Every row a test needs is
 * created with a unique suffix and removed by `cleanup()`; nothing else is touched.
 */
const env = parseEnv({
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://ee:ee@localhost:5432/ee',
  JWT_SECRET: process.env.JWT_SECRET ?? 'test-secret-that-is-at-least-32-chars-long',
  NODE_ENV: 'test',
});

export interface Actor {
  accountId: string;
  token: string;
  name: string;
}

export interface Supplier extends Actor {
  profileId: string;
}

export interface Listing {
  id: string;
  supplier: Supplier;
  unitIds: string[];
  pricePerDay: number;
  title: string;
}

export interface RateCardSeed {
  weekRate?: number | null;
  monthRate?: number | null;
  transportFee?: number | null;
  operatorRatePerDay?: number | null;
  depositAmount?: number | null;
}

export class RentalFlowHarness {
  readonly accountIds: string[] = [];
  private refs?: { cityId: string; modelId: string };

  private constructor(
    readonly app: NestFastifyApplication,
    readonly db: Database,
    private readonly tokens: TokenService,
  ) {}

  static async start(): Promise<RentalFlowHarness> {
    const app = await NestFactory.create<NestFastifyApplication>(
      AppModule.forRoot(env),
      new FastifyAdapter(),
      { logger: false },
    );
    await configureApp(app, env);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    return new RentalFlowHarness(app, app.get<Database>(DB), app.get(TokenService));
  }

  async request<T = unknown>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH',
    url: string,
    token?: string,
    payload?: unknown,
  ): Promise<{ status: number; body: T }> {
    const res = await this.app.inject({
      method,
      url,
      headers: token ? { authorization: `Bearer ${token}` } : {},
      ...(payload === undefined ? {} : { payload: payload as object }),
    });
    return { status: res.statusCode, body: (res.body ? res.json() : undefined) as T };
  }

  async account(role: AccountRole, label: string): Promise<Actor> {
    const suffix = randomUUID().slice(0, 8);
    const name = `${label} ${suffix}`;
    const [row] = await this.db
      .insert(accounts)
      .values({
        email: `rental-flow-${suffix}@test.local`,
        passwordHash: 'x',
        displayName: name,
        role,
      })
      .returning({ id: accounts.id });
    this.accountIds.push(row!.id);
    const token = this.tokens.signAccessToken({ accountId: row!.id, role }).accessToken;
    return { accountId: row!.id, token, name };
  }

  builder(label = 'Builder'): Promise<Actor> {
    return this.account('BUILDER', label);
  }

  async supplier(label = 'Supplier'): Promise<Supplier> {
    const actor = await this.account('SUPPLIER', label);
    const [profile] = await this.db
      .insert(supplierProfiles)
      .values({ accountId: actor.accountId, displayName: `${actor.name} Rentals` })
      .returning({ id: supplierProfiles.id });
    return { ...actor, name: `${actor.name} Rentals`, profileId: profile!.id };
  }

  async listing(
    supplier: Supplier,
    opts: {
      units?: number;
      pricePerDay?: number;
      rateCard?: RateCardSeed;
      status?: 'ACTIVE' | 'DRAFT';
    } = {},
  ): Promise<Listing> {
    const { cityId, modelId } = await this.referenceData();
    const pricePerDay = opts.pricePerDay ?? 10000;
    const title = `Excavator ${randomUUID().slice(0, 8)}`;
    const [listing] = await this.db
      .insert(equipmentListings)
      .values({
        supplierProfileId: supplier.profileId,
        modelId,
        cityId,
        title,
        description: 'Test listing',
        location: 'Test yard',
        pricePerDay: toNumericString(pricePerDay),
        status: opts.status ?? 'ACTIVE',
      })
      .returning({ id: equipmentListings.id });
    const [yard] = await this.db
      .insert(yards)
      .values({
        supplierProfileId: supplier.profileId,
        name: `Yard ${randomUUID().slice(0, 8)}`,
        cityId,
        address: 'Test address',
      })
      .returning({ id: yards.id });
    const unitIds: string[] = [];
    for (let i = 0; i < (opts.units ?? 1); i++) {
      const [unit] = await this.db
        .insert(equipmentUnits)
        .values({
          supplierProfileId: supplier.profileId,
          listingId: listing!.id,
          yardId: yard!.id,
          modelYear: 2022,
          condition: 'GOOD',
          label: `Unit ${i + 1}`,
        })
        .returning({ id: equipmentUnits.id });
      unitIds.push(unit!.id);
    }
    if (opts.rateCard) {
      const money = (v: number | null | undefined) => (v == null ? null : toNumericString(v));
      await this.db.insert(rateCards).values({
        listingId: listing!.id,
        weekRate: money(opts.rateCard.weekRate),
        monthRate: money(opts.rateCard.monthRate),
        transportFee: money(opts.rateCard.transportFee),
        operatorRatePerDay: money(opts.rateCard.operatorRatePerDay),
        depositAmount: money(opts.rateCard.depositAmount),
      });
    }
    return { id: listing!.id, supplier, unitIds, pricePerDay, title };
  }

  /** Removes every row created through this harness, children first. */
  async cleanup(): Promise<void> {
    if (this.accountIds.length === 0) return;
    const ids = [...this.accountIds];
    const profileIds = (
      await this.db
        .select({ id: supplierProfiles.id })
        .from(supplierProfiles)
        .where(inArray(supplierProfiles.accountId, ids))
    ).map((r) => r.id);
    const listingIds = profileIds.length
      ? (
          await this.db
            .select({ id: equipmentListings.id })
            .from(equipmentListings)
            .where(inArray(equipmentListings.supplierProfileId, profileIds))
        ).map((r) => r.id)
      : [];
    await this.db.delete(bookings).where(inArray(bookings.builderAccountId, ids));
    if (profileIds.length) {
      await this.db.delete(bookings).where(inArray(bookings.supplierProfileId, profileIds));
      await this.db.delete(quotes).where(inArray(quotes.supplierProfileId, profileIds));
    }
    if (listingIds.length) {
      await this.db.delete(rentalRequests).where(inArray(rentalRequests.listingId, listingIds));
    }
    await this.db.delete(rentalRequests).where(inArray(rentalRequests.builderAccountId, ids));
    await this.db.delete(requirements).where(inArray(requirements.builderAccountId, ids));
    await this.db.delete(maintenanceBlocks).where(inArray(maintenanceBlocks.createdBy, ids));
    await this.db.delete(accounts).where(inArray(accounts.id, ids));
    this.accountIds.length = 0;
  }

  async close(): Promise<void> {
    await this.cleanup();
    await this.app.close();
  }

  private async referenceData(): Promise<{ cityId: string; modelId: string }> {
    if (!this.refs) {
      const [city] = await this.db
        .select({ id: cities.id })
        .from(cities)
        .where(eq(cities.enabled, true))
        .limit(1);
      const [model] = await this.db
        .select({ id: equipmentModels.id })
        .from(equipmentModels)
        .where(eq(equipmentModels.status, 'ACTIVE'))
        .limit(1);
      if (!city || !model) throw new Error('Seed data missing: run pnpm db:seed');
      this.refs = { cityId: city.id, modelId: model.id };
    }
    return this.refs;
  }
}

export { dateFromToday } from './dates';
