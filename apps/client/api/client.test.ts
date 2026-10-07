import type { ClientKind } from '@ee/contracts';
import { describe, expect, it, vi } from 'vitest';
import type { AuthStorage } from '../platform/types';
import { createApiClient, toQueryString } from './client';
import { ApiError } from './errors';

const BASE = 'http://api.test';

const account = {
  id: '6f1c1b1e-2a7b-4d6e-9b55-3f0f9b1f2a10',
  email: 'pat@example.com',
  displayName: 'Pat',
  role: 'BUILDER',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function authBody(accessToken: string, refreshToken?: string) {
  return { account, accessToken, expiresIn: 900, ...(refreshToken ? { refreshToken } : {}) };
}

function json(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function memoryStorage(
  clientKind: ClientKind,
  initial: { access?: string; refresh?: string } = {},
) {
  let access = initial.access ?? null;
  let refresh = initial.refresh ?? null;
  const storage: AuthStorage = {
    clientKind,
    getAccessToken: () => access,
    setAccessToken: (t) => {
      access = t;
    },
    getRefreshToken: async () => refresh,
    setRefreshToken: async (t) => {
      refresh = t;
    },
    clear: vi.fn(async () => {
      access = null;
      refresh = null;
    }),
  };
  return storage;
}

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

function setup(
  clientKind: ClientKind,
  handler: Handler,
  initial?: { access?: string; refresh?: string },
) {
  const storage = memoryStorage(clientKind, initial);
  const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) =>
    Promise.resolve(handler(String(input).replace(BASE, ''), init ?? {})),
  );
  const onSessionExpired = vi.fn();
  const api = createApiClient({
    baseUrl: BASE,
    storage,
    onSessionExpired,
    fetch: fetchMock as unknown as typeof fetch,
  });
  const calls = (path: string) => fetchMock.mock.calls.filter(([u]) => String(u) === BASE + path);
  return { api, storage, fetchMock, onSessionExpired, calls };
}

function bearer(init: RequestInit): string | undefined {
  return (init.headers as Record<string, string>).Authorization;
}

/** `/auth/me` succeeds only with `Bearer fresh`; refresh hands out `fresh`. */
function meHandler(refreshResponse: () => Response = () => json(200, authBody('fresh', 'r2'))) {
  return (url: string, init: RequestInit) => {
    if (url === '/auth/refresh') return refreshResponse();
    if (url === '/auth/me') {
      return bearer(init) === 'Bearer fresh'
        ? json(200, account)
        : json(401, { code: 'invalid_token', message: 'expired' });
    }
    return json(404, { code: 'not_found', message: url });
  };
}

describe('createApiClient', () => {
  it('attaches the stored access token to authed requests', async () => {
    const { api, fetchMock } = setup('native', meHandler(), { access: 'fresh' });
    await expect(api.auth.me()).resolves.toEqual(account);
    expect(bearer(fetchMock.mock.calls[0]![1]!)).toBe('Bearer fresh');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refreshes on 401, stores the new tokens and retries the request', async () => {
    const { api, storage, calls } = setup('native', meHandler(), {
      access: 'stale',
      refresh: 'r1',
    });
    await expect(api.auth.me()).resolves.toEqual(account);
    expect(calls('/auth/refresh')).toHaveLength(1);
    expect(calls('/auth/me')).toHaveLength(2);
    expect(bearer(calls('/auth/me')[1]![1]!)).toBe('Bearer fresh');
    expect(storage.getAccessToken()).toBe('fresh');
    await expect(storage.getRefreshToken()).resolves.toBe('r2');
  });

  it('shares one refresh between concurrent 401s', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const handler = meHandler();
    const { api, calls } = setup(
      'native',
      async (url, init) => {
        if (url === '/auth/refresh') await gate;
        return handler(url, init);
      },
      { access: 'stale', refresh: 'r1' },
    );

    const results = Promise.all([api.auth.me(), api.auth.me(), api.auth.me()]);
    await vi.waitFor(() => expect(calls('/auth/refresh')).toHaveLength(1));
    release();

    await expect(results).resolves.toEqual([account, account, account]);
    expect(calls('/auth/refresh')).toHaveLength(1);
    expect(calls('/auth/me')).toHaveLength(6);
  });

  it('clears the session and reports expiry when refresh is rejected', async () => {
    const { api, storage, onSessionExpired } = setup(
      'native',
      meHandler(() => json(401, { code: 'invalid_refresh_token', message: 'used' })),
      { access: 'stale', refresh: 'r1' },
    );
    const results = await Promise.allSettled([api.auth.me(), api.auth.me()]);
    for (const r of results) {
      expect(r.status).toBe('rejected');
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(ApiError);
      expect((r as PromiseRejectedResult).reason.code).toBe('invalid_refresh_token');
    }
    expect(storage.clear).toHaveBeenCalledTimes(1);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(storage.getAccessToken()).toBeNull();
  });

  it('keeps the session when refresh fails for a network reason', async () => {
    const { api, storage, onSessionExpired } = setup(
      'native',
      meHandler(() => {
        throw new TypeError('Network request failed');
      }),
      { access: 'stale', refresh: 'r1' },
    );
    await expect(api.auth.me()).rejects.toThrow('Network request failed');
    expect(storage.clear).not.toHaveBeenCalled();
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('does not refresh when login is rejected', async () => {
    const { api, calls } = setup('native', () =>
      json(401, { code: 'invalid_credentials', message: 'Invalid email or password' }),
    );
    await expect(api.auth.login({ email: 'a@b.co', password: 'nope' })).rejects.toMatchObject({
      status: 401,
      code: 'invalid_credentials',
    });
    expect(calls('/auth/refresh')).toHaveLength(0);
  });

  it('retries at most once', async () => {
    const { api, calls } = setup(
      'native',
      (url) =>
        url === '/auth/refresh'
          ? json(200, authBody('also-rejected', 'r2'))
          : json(401, { code: 'invalid_token', message: 'nope' }),
      { access: 'stale', refresh: 'r1' },
    );
    await expect(api.auth.me()).rejects.toMatchObject({ status: 401, code: 'invalid_token' });
    expect(calls('/auth/refresh')).toHaveLength(1);
    expect(calls('/auth/me')).toHaveLength(2);
  });

  it('web relies on the cookie: sends credentials and no refresh token in the body', async () => {
    const { api, fetchMock, calls } = setup(
      'web',
      meHandler(() => json(200, authBody('fresh'))),
      {
        access: 'stale',
      },
    );
    await api.auth.me();
    for (const [, init] of fetchMock.mock.calls) expect(init!.credentials).toBe('include');
    expect(JSON.parse(calls('/auth/refresh')[0]![1]!.body as string)).toEqual({ client: 'web' });
  });

  it('native sends the stored refresh token and omits credentials', async () => {
    const { api, calls } = setup('native', meHandler(), { access: 'stale', refresh: 'r1' });
    await api.auth.me();
    const [, init] = calls('/auth/refresh')[0]!;
    expect(init!.credentials).toBe('omit');
    expect(JSON.parse(init!.body as string)).toEqual({ client: 'native', refreshToken: 'r1' });
  });

  it('native refresh without a stored token ends the session without calling the api', async () => {
    const { api, calls, onSessionExpired } = setup('native', meHandler());
    await expect(api.auth.refresh()).rejects.toMatchObject({ code: 'invalid_refresh_token' });
    expect(calls('/auth/refresh')).toHaveLength(0);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('maps validation_failed errors to field errors', async () => {
    const { api } = setup('native', () =>
      json(400, {
        code: 'validation_failed',
        message: 'Request validation failed',
        errors: [
          { path: 'password', message: 'Too small' },
          { path: 'email', message: 'Invalid email' },
        ],
      }),
    );
    const error = await api.auth
      .register({ email: 'x', password: 'y', displayName: 'Z', role: 'BUILDER' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).fieldErrors).toEqual({
      password: 'Too small',
      email: 'Invalid email',
    });
  });

  it('login sends the client kind and stores the returned tokens', async () => {
    const { api, storage, calls } = setup('native', () => json(200, authBody('a1', 'r1')));
    await api.auth.login({ email: 'pat@example.com', password: 'secret123' });
    expect(JSON.parse(calls('/auth/login')[0]![1]!.body as string)).toMatchObject({
      client: 'native',
    });
    expect(storage.getAccessToken()).toBe('a1');
    await expect(storage.getRefreshToken()).resolves.toBe('r1');
  });
});

describe('listing endpoints', () => {
  const LISTING = '11111111-1111-4111-8111-111111111111';
  const MEDIA = '22222222-2222-4222-8222-222222222222';
  const media = (id: string, position: number) => ({
    id,
    url: `/equipment-listings/${LISTING}/media/${id}`,
    originalFilename: 'photo.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 1024,
    position,
    createdAt: '2026-01-01T00:00:00.000Z',
  });

  it('reorders photos with PUT and a JSON body', async () => {
    const { api, calls } = setup(
      'native',
      (_url, init) =>
        init.method === 'PUT' ? json(200, { items: [media(MEDIA, 0)] }) : json(404, {}),
      { access: 'fresh' },
    );
    await api.listingMedia.reorder(LISTING, [MEDIA]);
    const [, init] = calls(`/supplier/listings/${LISTING}/media/order`)[0]!;
    expect(init!.method).toBe('PUT');
    expect(JSON.parse(init!.body as string)).toEqual({ mediaIds: [MEDIA] });
    expect((init!.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('deletes a photo and resolves on 204', async () => {
    const { api, calls } = setup('native', () => new Response(null, { status: 204 }), {
      access: 'fresh',
    });
    await expect(api.listingMedia.remove(LISTING, MEDIA)).resolves.toBeUndefined();
    expect(calls(`/supplier/listings/${LISTING}/media/${MEDIA}`)[0]![1]!.method).toBe('DELETE');
  });

  it('uploads a photo as multipart without forcing a Content-Type', async () => {
    const { api, calls } = setup('web', () => json(201, media(MEDIA, 0)), { access: 'fresh' });
    const file = new Blob(['jpeg-bytes'], { type: 'image/jpeg' });
    await api.listingMedia.upload(LISTING, file);
    const [, init] = calls(`/supplier/listings/${LISTING}/media`)[0]!;
    expect(init!.body).toBeInstanceOf(FormData);
    expect((init!.body as FormData).get('file')).toBeInstanceOf(Blob);
    const headers = init!.headers as Record<string, string>;
    expect(headers['Content-Type']).toBeUndefined();
    expect(headers.Authorization).toBe('Bearer fresh');
  });

  it('browses public listings with a query string and no token', async () => {
    const { api, fetchMock } = setup(
      'native',
      () => json(200, { items: [], total: 0, limit: 20, offset: 20 }),
      { access: 'fresh' },
    );
    await api.listings.browse({ city: 'IN-HYD', minPrice: 100, limit: 20, offset: 20 });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(
      `${BASE}/equipment-listings?city=IN-HYD&minPrice=100&limit=20&offset=20`,
    );
    expect(bearer(init!)).toBeUndefined();
  });
});

describe('toQueryString', () => {
  it('skips empty values and encodes the rest', () => {
    expect(toQueryString({ a: 'x y', b: undefined, c: '', d: 0, e: null })).toBe('?a=x+y&d=0');
    expect(toQueryString({})).toBe('');
  });
});
