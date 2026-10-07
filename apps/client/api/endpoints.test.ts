import { allFeatureRoutes } from '@ee/contracts';
import { describe, expect, it } from 'vitest';
import type { AuthStorage } from '../platform/types';
import { createApiClient, type ApiClient } from './client';
import { ApiError } from './errors';

const BASE = 'http://api.test';
const ID = '00000000-0000-4000-8000-000000000001';

const storage: AuthStorage = {
  clientKind: 'web',
  getAccessToken: () => 'token',
  setAccessToken: () => {},
  getRefreshToken: async () => null,
  setRefreshToken: async () => {},
  clear: async () => {},
};

/** Every feature call, with arguments; bodies are not validated client-side. */
const calls = (api: ApiClient): (() => Promise<unknown>)[] => {
  const body = {} as never;
  return [
    () => api.rentalRequests.create(body),
    () => api.rentalRequests.mine({ status: 'PENDING' }),
    () => api.rentalRequests.cancel(ID),
    () => api.rentalRequests.incoming({ listingId: ID }),
    () => api.rentalRequests.markViewed(ID),
    () => api.rentalRequests.reject(ID),
    () => api.rentalRequests.get(ID),
    () => api.rateCards.get(ID),
    () => api.rateCards.put(ID, body),
    () => api.quotes.create(body),
    () => api.quotes.listForSupplier(),
    () => api.quotes.update(ID, body),
    () => api.quotes.send(ID),
    () => api.quotes.listForBuilder(),
    () => api.quotes.accept(ID),
    () => api.quotes.reject(ID),
    () => api.quotes.get(ID),
    () => api.bookings.listForSupplier(),
    () => api.bookings.listForBuilder(),
    () => api.bookings.get(ID),
    () => api.bookings.dispatch(ID),
    () => api.bookings.startRent(ID),
    () => api.bookings.complete(ID),
    () => api.bookings.cancel(ID, body),
    () => api.requirements.create(body),
    () => api.requirements.list(),
    () => api.requirements.get(ID),
    () => api.requirements.update(ID, body),
    () => api.requirements.matches(ID),
    () => api.requirements.send(ID, body),
    () => api.requirements.cancel(ID),
    () => api.notifications.list({ unreadOnly: true }),
    () => api.notifications.markRead(ID),
    () => api.notifications.markAllRead(),
    () => api.equipmentAssistant.createConversation(),
    () => api.equipmentAssistant.listConversations(),
    () => api.equipmentAssistant.getConversation(ID),
    () => api.equipmentAssistant.sendMessage(ID, body),
    () => api.supplierAgent.createConversation(),
    () => api.supplierAgent.listConversations(),
    () => api.supplierAgent.getConversation(ID),
    () => api.supplierAgent.sendMessage(ID, body),
    () => api.supplierAgent.confirmAction(ID),
    () => api.supplierAgent.cancelAction(ID),
  ];
};

function notImplementedClient() {
  const seen: string[] = [];
  const fetchImpl = (async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    seen.push(`${init?.method ?? 'GET'} ${url.pathname.replaceAll(ID, ':id')}${url.search}`);
    return new Response(
      JSON.stringify({ code: 'NOT_IMPLEMENTED', message: 'This endpoint is not implemented yet' }),
      { status: 501, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;
  const api = createApiClient({
    baseUrl: BASE,
    storage,
    onSessionExpired: () => {},
    fetch: fetchImpl,
  });
  return { api, seen };
}

describe('feature endpoints', () => {
  it('has one typed call for every contract route', async () => {
    const { api, seen } = notImplementedClient();
    for (const call of calls(api)) await call().catch(() => {});
    const called = seen.map((s) => s.split('?')[0]);
    expect(new Set(called).size).toBe(called.length);
    expect([...called].sort()).toEqual(allFeatureRoutes.map((r) => `${r.method} ${r.path}`).sort());
  });

  it('surfaces a 501 as ApiError NOT_IMPLEMENTED', async () => {
    const { api } = notImplementedClient();
    const error = await api.quotes.get(ID).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 501, code: 'NOT_IMPLEMENTED' });
  });

  it('serialises list filters into the query string', async () => {
    const { api, seen } = notImplementedClient();
    await api.notifications.list({ unreadOnly: false, limit: 10 }).catch(() => {});
    await api.rentalRequests.incoming({ listingId: ID, offset: 20 }).catch(() => {});
    expect(seen).toEqual([
      'GET /notifications?limit=10&unreadOnly=false',
      `GET /rental-requests/incoming?listingId=${ID}&offset=20`,
    ]);
  });
});
