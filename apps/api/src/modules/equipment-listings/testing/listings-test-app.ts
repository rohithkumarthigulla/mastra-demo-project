import 'reflect-metadata';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import type { AccountRole } from '@ee/contracts';
import { AuthGuard, CLOCK, RolesGuard, TokenService, type Clock } from '../../../platform/auth';
import { ConfigModule, parseEnv } from '../../../platform/config';
import { configureApp } from '../../../platform/http';
import { EquipmentListingsService, ListingMediaService } from '../application';
import {
  EQUIPMENT_LISTING_REPOSITORY,
  LISTING_MEDIA_REPOSITORY,
  LISTING_MEDIA_STORAGE,
} from '../domain';
import {
  OptionalAuthGuard,
  PublicListingsController,
  SupplierListingMediaController,
  SupplierListingsController,
} from '../http';
import { LocalDiskMediaStorage } from '../infrastructure';
import { InMemoryEquipmentListingsRepository } from './in-memory-equipment-listings.repository';
import { InMemoryListingMediaRepository } from './in-memory-listing-media.repository';

export const env = parseEnv({
  DATABASE_URL: 'postgres://unused:unused@localhost:5432/unused',
  JWT_SECRET: 'test-secret-that-is-at-least-32-chars-long',
  LISTING_MEDIA_MAX_BYTES: String(64 * 1024),
});

export const SUPPLIER_A = '00000000-0000-4000-8000-00000000000a';
export const SUPPLIER_B = '00000000-0000-4000-8000-00000000000b';
export const NO_PROFILE = '00000000-0000-4000-8000-00000000000c';
export const EXCAVATOR = '10000000-0000-4000-8000-000000000001';
export const CRANE = '10000000-0000-4000-8000-000000000002';
export const RETIRED = '10000000-0000-4000-8000-000000000003';
export const UNKNOWN_ID = '99999999-0000-4000-8000-000000000000';

let app: NestFastifyApplication | undefined;
let mediaDir: string | undefined;

/** Call from `afterEach` in every spec that uses `createApp`. */
export async function closeApp(): Promise<void> {
  await app?.close();
  app = undefined;
  if (mediaDir) await rm(mediaDir, { recursive: true, force: true });
  mediaDir = undefined;
}

function seed(repo: InMemoryEquipmentListingsRepository): void {
  repo.cities.push(
    { id: 'c-hyd', geoId: 'IN-TG-HYD', name: 'Hyderabad', enabled: true },
    { id: 'c-blr', geoId: 'IN-KA-BLR', name: 'Bengaluru', enabled: true },
    { id: 'c-off', geoId: 'IN-XX-OFF', name: 'Disabled City', enabled: false },
  );
  const jcb = { id: '20000000-0000-4000-8000-000000000001', name: 'JCB' };
  const tata = { id: '20000000-0000-4000-8000-000000000002', name: 'Tata Hitachi' };
  repo.models.push(
    {
      id: EXCAVATOR,
      modelName: 'JS205',
      status: 'ACTIVE',
      manufacturer: jcb,
      category: { code: 'EXCAVATOR', displayName: 'Excavator' },
    },
    {
      id: CRANE,
      modelName: 'TMX 20',
      status: 'ACTIVE',
      manufacturer: tata,
      category: { code: 'CRANE', displayName: 'Crane' },
    },
    {
      id: RETIRED,
      modelName: 'Old One',
      status: 'INACTIVE',
      manufacturer: jcb,
      category: { code: 'EXCAVATOR', displayName: 'Excavator' },
    },
  );
  repo.profiles.push(
    { id: 'p-a', accountId: SUPPLIER_A, displayName: 'Acme Rentals' },
    { id: 'p-b', accountId: SUPPLIER_B, displayName: 'Beta Hire' },
  );
}

export async function createApp() {
  let now = new Date('2026-01-01T00:00:00Z');
  const clock: Clock = { now: () => now };
  const repo = new InMemoryEquipmentListingsRepository();
  seed(repo);
  const mediaRepo = new InMemoryListingMediaRepository();
  repo.photosFor = mediaRepo.photosFor;
  const activeUnits = new Map<string, number>();
  repo.activeUnitsFor = (listingId) => activeUnits.get(listingId) ?? 0;
  const dir = await mkdtemp(join(tmpdir(), 'listing-media-'));
  mediaDir = dir;
  const storage = new LocalDiskMediaStorage(dir);

  @Module({
    imports: [ConfigModule.forRoot(env), JwtModule.register({ secret: env.JWT_SECRET })],
    controllers: [
      SupplierListingsController,
      SupplierListingMediaController,
      PublicListingsController,
    ],
    providers: [
      EquipmentListingsService,
      ListingMediaService,
      OptionalAuthGuard,
      TokenService,
      AuthGuard,
      RolesGuard,
      { provide: CLOCK, useValue: clock },
      { provide: EQUIPMENT_LISTING_REPOSITORY, useValue: repo },
      { provide: LISTING_MEDIA_REPOSITORY, useValue: mediaRepo },
      { provide: LISTING_MEDIA_STORAGE, useValue: storage },
    ],
  })
  class TestModule {}

  app = await NestFactory.create<NestFastifyApplication>(TestModule, new FastifyAdapter(), {
    logger: false,
  });
  await configureApp(app, env);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  const server = app;
  const tokens = app.get(TokenService);

  const tokenFor = (role: AccountRole, accountId = SUPPLIER_A) =>
    tokens.signAccessToken({ accountId, role }).accessToken;
  const request = (
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    url: string,
    token?: string,
    payload?: object,
  ) =>
    server.inject({
      method,
      url,
      payload,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });

  const supplierA = tokenFor('SUPPLIER', SUPPLIER_A);
  const supplierB = tokenFor('SUPPLIER', SUPPLIER_B);

  async function createListing(token: string, overrides: object = {}) {
    const res = await request('POST', '/supplier/listings', token, {
      modelId: EXCAVATOR,
      cityGeoId: 'IN-TG-HYD',
      title: 'JCB excavator with operator',
      description: 'Well maintained excavator available for daily hire.',
      location: 'Gachibowli, Hyderabad',
      pricePerDay: 12500.5,
      ...overrides,
    });
    assert.equal(res.statusCode, 201, res.body);
    // Distinct createdAt values keep "newest first" ordering deterministic.
    now = new Date(now.getTime() + 1000);
    return res.json<{ id: string; status: string }>();
  }

  async function createPublished(token: string, overrides: object = {}) {
    const listing = await createListing(token, overrides);
    activeUnits.set(listing.id, 1);
    const res = await request('POST', `/supplier/listings/${listing.id}/publish`, token);
    assert.equal(res.statusCode, 200, res.body);
    return listing;
  }

  /** Sends `data` as the single file part of a multipart upload. */
  const upload = (
    listingId: string,
    token: string | undefined,
    data: Buffer,
    filename = 'photo.jpg',
  ) => {
    const boundary = '----listing-media-test';
    const payload = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
          'Content-Type: image/jpeg\r\n\r\n',
      ),
      data,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    return server.inject({
      method: 'POST',
      url: `/supplier/listings/${listingId}/media`,
      payload,
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    });
  };

  return {
    request,
    upload,
    tokenFor,
    supplierA,
    supplierB,
    createListing,
    createPublished,
    mediaRepo,
    mediaDir: dir,
    activeUnits,
  };
}
