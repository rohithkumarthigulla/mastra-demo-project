import 'reflect-metadata';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import type { NotificationDto, NotificationPageDto } from '@ee/contracts';
import { AuthGuard, CLOCK, TokenService, type Clock } from '../../../platform/auth';
import { ConfigModule, parseEnv } from '../../../platform/config';
import { configureApp } from '../../../platform/http';
import { NotificationsService } from '../application';
import { NOTIFICATIONS_REPOSITORY } from '../domain';
import { InMemoryNotificationsRepository } from '../testing/in-memory-notifications.repository';
import { NotificationsController } from './notifications.controller';

const env = parseEnv({
  DATABASE_URL: 'postgres://unused:unused@localhost:5432/unused',
  JWT_SECRET: 'test-secret-that-is-at-least-32-chars-long',
});

const SUPPLIER = '00000000-0000-4000-8000-00000000000a';
const BUILDER = '00000000-0000-4000-8000-0000000000b1';
const UNKNOWN_ID = '99999999-0000-4000-8000-000000000000';

let app: NestFastifyApplication | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function createApp() {
  let now = new Date('2026-01-01T00:00:00Z');
  const clock: Clock = { now: () => now };
  const repo = new InMemoryNotificationsRepository();

  @Module({
    imports: [ConfigModule.forRoot(env), JwtModule.register({ secret: env.JWT_SECRET })],
    controllers: [NotificationsController],
    providers: [
      NotificationsService,
      TokenService,
      AuthGuard,
      { provide: CLOCK, useValue: clock },
      { provide: NOTIFICATIONS_REPOSITORY, useValue: repo },
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
  const service = app.get(NotificationsService);

  const request = (method: 'GET' | 'POST', url: string, token?: string) =>
    server.inject({ method, url, headers: token ? { authorization: `Bearer ${token}` } : {} });

  /** Sends one notification per title, one second apart, so creation order is unambiguous. */
  const notify = async (accountId: string, ...titles: string[]) => {
    for (const title of titles) {
      await service.notify([
        { accountId, kind: 'REQUEST_RECEIVED', title, href: '/supplier/requests', tone: 'waiting' },
      ]);
      now = new Date(now.getTime() + 1000);
    }
  };

  return {
    request,
    notify,
    service,
    supplier: tokens.signAccessToken({ accountId: SUPPLIER, role: 'SUPPLIER' }).accessToken,
    builder: tokens.signAccessToken({ accountId: BUILDER, role: 'BUILDER' }).accessToken,
  };
}

describe('notifications', () => {
  it('requires a signed-in account', async () => {
    const t = await createApp();
    assert.equal((await t.request('GET', '/notifications')).statusCode, 401);
    assert.equal((await t.request('POST', '/notifications/read-all')).statusCode, 401);
  });

  it('lists only my notifications, newest first, with an account-wide unread count', async () => {
    const t = await createApp();
    await t.notify(SUPPLIER, 'first', 'second', 'third');
    await t.notify(BUILDER, 'not mine');

    const res = await t.request('GET', '/notifications?limit=2', t.supplier);
    assert.equal(res.statusCode, 200);
    const page = res.json<NotificationPageDto>();
    assert.deepEqual(
      page.items.map((n) => n.title),
      ['third', 'second'],
    );
    assert.equal(page.total, 3);
    assert.equal(page.unreadCount, 3);
    assert.equal(page.limit, 2);
    assert.equal(page.offset, 0);
    assert.equal(page.items[0]?.readAt, null);
    assert.equal(page.items[0]?.href, '/supplier/requests');
  });

  it('marks one read idempotently and filters unread', async () => {
    const t = await createApp();
    await t.notify(SUPPLIER, 'first', 'second');
    const [newest] = (
      await t.request('GET', '/notifications', t.supplier)
    ).json<NotificationPageDto>().items;
    assert.ok(newest);

    const first = await t.request('POST', `/notifications/${newest.id}/read`, t.supplier);
    assert.equal(first.statusCode, 200);
    const readAt = first.json<NotificationDto>().readAt;
    assert.ok(readAt);

    const again = await t.request('POST', `/notifications/${newest.id}/read`, t.supplier);
    assert.equal(again.statusCode, 200);
    assert.equal(again.json<NotificationDto>().readAt, readAt, 'readAt is not moved');

    const unread = (
      await t.request('GET', '/notifications?unreadOnly=true', t.supplier)
    ).json<NotificationPageDto>();
    assert.deepEqual(
      unread.items.map((n) => n.title),
      ['first'],
    );
    assert.equal(unread.unreadCount, 1);
  });

  it("returns 404 for an unknown id or another account's notification", async () => {
    const t = await createApp();
    await t.notify(BUILDER, 'builder only');
    const [theirs] = (
      await t.request('GET', '/notifications', t.builder)
    ).json<NotificationPageDto>().items;
    assert.ok(theirs);

    const other = await t.request('POST', `/notifications/${theirs.id}/read`, t.supplier);
    assert.equal(other.statusCode, 404);
    const unknown = await t.request('POST', `/notifications/${UNKNOWN_ID}/read`, t.supplier);
    assert.equal(unknown.statusCode, 404);
    const malformed = await t.request('POST', '/notifications/not-a-uuid/read', t.supplier);
    assert.equal(malformed.statusCode, 404);

    const builderView = (
      await t.request('GET', '/notifications', t.builder)
    ).json<NotificationPageDto>();
    assert.equal(builderView.unreadCount, 1, 'another account cannot mark it read');
  });

  it('marks all read idempotently, scoped to my account', async () => {
    const t = await createApp();
    await t.notify(SUPPLIER, 'a', 'b');
    await t.notify(BUILDER, 'c');

    const first = await t.request('POST', '/notifications/read-all', t.supplier);
    assert.equal(first.statusCode, 200);
    assert.deepEqual(first.json(), { updated: 2 });
    const again = await t.request('POST', '/notifications/read-all', t.supplier);
    assert.deepEqual(again.json(), { updated: 0 });

    const mine = (await t.request('GET', '/notifications', t.supplier)).json<NotificationPageDto>();
    assert.equal(mine.unreadCount, 0);
    const theirs = (
      await t.request('GET', '/notifications', t.builder)
    ).json<NotificationPageDto>();
    assert.equal(theirs.unreadCount, 1);
  });

  it('defaults the tone from the kind unless the caller sets one', async () => {
    const t = await createApp();
    await t.service.notify([
      { accountId: BUILDER, kind: 'BOOKING_CONFIRMED', title: 'default', href: '/bookings' },
    ]);
    await t.service.notify([
      { accountId: BUILDER, kind: 'BOOKING_CONFIRMED', title: 'explicit', tone: 'neutral' },
    ]);
    const tones = Object.fromEntries(
      (await t.request('GET', '/notifications', t.builder))
        .json<NotificationPageDto>()
        .items.map((n) => [n.title, n.tone]),
    );
    assert.deepEqual(tones, { default: 'good', explicit: 'neutral' });
  });
});
