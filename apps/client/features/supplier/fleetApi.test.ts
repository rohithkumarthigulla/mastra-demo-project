import { describe, expect, it } from 'vitest';
import { createApiClient } from '../../api/client';
import type { AuthStorage } from '../../platform/types';
import { fleetApi } from './fleetApi';
import { fleetCalendarFixture } from './fixtures';

const ID = '00000000-0000-4000-8000-000000000001';

const storage: AuthStorage = {
  clientKind: 'web',
  getAccessToken: () => 'token',
  setAccessToken: () => {},
  getRefreshToken: async () => null,
  setRefreshToken: async () => {},
  clear: async () => {},
};

function client(respond: (path: string) => unknown = () => ({})) {
  const seen: string[] = [];
  const fetchImpl = (async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    seen.push(`${init?.method ?? 'GET'} ${url.pathname.replaceAll(ID, ':id')}${url.search}`);
    const body = respond(url.pathname);
    return body === undefined
      ? new Response(null, { status: 204 })
      : new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  const api = createApiClient({
    baseUrl: 'http://api.test',
    storage,
    onSessionExpired: () => {},
    fetch: fetchImpl,
  });
  return { calls: fleetApi(api), seen };
}

describe('fleetApi', () => {
  it('calls the fleet and availability routes the api serves', async () => {
    const { calls, seen } = client();
    const body = {} as never;
    const range = { from: '2026-10-06T18:30:00.000Z', to: '2026-10-07T18:30:00.000Z' };
    const all = [
      () => calls.yards.list(),
      () => calls.yards.create(body),
      () => calls.yards.update(ID, body),
      () => calls.yards.remove(ID),
      () => calls.units.list({ listingId: ID, status: 'ACTIVE' }),
      () => calls.units.get(ID),
      () => calls.units.create(body),
      () => calls.units.update(ID, body),
      () => calls.units.retire(ID),
      () => calls.availability.fleet(range),
      () => calls.availability.unit(ID, range),
      () => calls.availability.createBlock(ID, body),
      () => calls.availability.liftBlock(ID),
    ];
    // Responses fail schema parsing here; only the requests matter.
    for (const call of all) await call().catch(() => {});
    const q = `?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
    expect(seen).toEqual([
      'GET /fleet/yards',
      'POST /fleet/yards',
      'PATCH /fleet/yards/:id',
      'DELETE /fleet/yards/:id',
      `GET /fleet/units?listingId=${ID}&status=ACTIVE`,
      'GET /fleet/units/:id',
      'POST /fleet/units',
      'PATCH /fleet/units/:id',
      'POST /fleet/units/:id/retire',
      `GET /availability/fleet${q}`,
      `GET /availability/units/:id${q}`,
      'POST /availability/units/:id/blocks',
      'DELETE /availability/blocks/:id',
    ]);
  });

  it('parses responses with the contract schemas', async () => {
    const calendar = fleetCalendarFixture();
    const { calls } = client((path) => (path === '/fleet/yards' ? [] : calendar));
    await expect(calls.yards.list()).resolves.toEqual([]);
    await expect(
      calls.availability.fleet({ from: calendar.from, to: calendar.to }),
    ).resolves.toEqual(calendar);
  });

  it('resolves a yard delete with no content', async () => {
    const { calls } = client(() => undefined);
    await expect(calls.yards.remove(ID)).resolves.toBeUndefined();
  });
});
