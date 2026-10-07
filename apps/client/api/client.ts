import {
  accountSchema,
  authResponseSchema,
  supplierProfileSchema,
  type AccountDto,
  type AuthResponse,
  type ClientKind,
  type CreateSupplierProfileRequest,
  type LoginRequest,
  type RegisterRequest,
  type SupplierProfileDto,
} from '@ee/contracts';
import type { ZodType } from 'zod';
import type { AuthStorage } from '../platform/types';
import { ApiError, toApiError } from './errors';

export interface ApiClientOptions {
  baseUrl: string;
  storage: AuthStorage;
  /** Called once when a refresh is rejected and the stored session has been cleared. */
  onSessionExpired: () => void;
  fetch?: typeof fetch;
}

interface RequestOptions<T> {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  schema?: ZodType<T>;
  /** Send the access token and refresh-and-retry once on 401. */
  auth?: boolean;
}

type WithoutClient<T> = Omit<T, 'client'>;

export function createApiClient(options: ApiClientOptions) {
  const { baseUrl, storage, onSessionExpired } = options;
  const fetchImpl = options.fetch ?? fetch;
  const clientKind: ClientKind = storage.clientKind;

  let inflightRefresh: Promise<AuthResponse> | null = null;

  async function send(path: string, opts: RequestOptions<unknown>): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    const token = opts.auth === false ? null : storage.getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    return fetchImpl(`${baseUrl}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      // Web keeps the refresh token in an httpOnly cookie, so it must travel cross-origin.
      credentials: clientKind === 'web' ? 'include' : 'omit',
    });
  }

  async function parse<T>(res: Response, schema?: ZodType<T>): Promise<T> {
    if (!res.ok) throw await toApiError(res);
    if (!schema || res.status === 204) return undefined as T;
    return schema.parse(await res.json());
  }

  async function storeSession(auth: AuthResponse): Promise<AuthResponse> {
    storage.setAccessToken(auth.accessToken);
    if (clientKind === 'native' && auth.refreshToken) {
      await storage.setRefreshToken(auth.refreshToken);
    }
    return auth;
  }

  async function doRefresh(): Promise<AuthResponse> {
    const body: { client: ClientKind; refreshToken?: string } = { client: clientKind };
    if (clientKind === 'native') {
      const refreshToken = await storage.getRefreshToken();
      if (!refreshToken) {
        throw new ApiError(401, 'invalid_refresh_token', 'No stored session');
      }
      body.refreshToken = refreshToken;
    }
    const res = await send('/auth/refresh', { method: 'POST', body, auth: false });
    return storeSession(await parse(res, authResponseSchema));
  }

  /**
   * Refresh tokens rotate, so two parallel refreshes would invalidate each other.
   * Every caller shares the one in-flight refresh.
   */
  function refreshOnce(): Promise<AuthResponse> {
    inflightRefresh ??= doRefresh()
      .catch(async (error: unknown) => {
        // Only a rejected token ends the session; a network failure may be temporary.
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          await storage.clear();
          onSessionExpired();
        }
        throw error;
      })
      .finally(() => {
        inflightRefresh = null;
      });
    return inflightRefresh;
  }

  async function request<T>(path: string, opts: RequestOptions<T> = {}): Promise<T> {
    const auth = opts.auth ?? true;
    let res = await send(path, { ...opts, auth });
    if (res.status === 401 && auth) {
      await refreshOnce();
      res = await send(path, { ...opts, auth });
    }
    return parse(res, opts.schema);
  }

  return {
    clientKind,
    request,
    auth: {
      register: async (body: WithoutClient<RegisterRequest>) =>
        storeSession(
          await request('/auth/register', {
            method: 'POST',
            body: { ...body, client: clientKind },
            schema: authResponseSchema,
            auth: false,
          }),
        ),
      login: async (body: WithoutClient<LoginRequest>) =>
        storeSession(
          await request('/auth/login', {
            method: 'POST',
            body: { ...body, client: clientKind },
            schema: authResponseSchema,
            auth: false,
          }),
        ),
      refresh: refreshOnce,
      logout: async (): Promise<void> => {
        const refreshToken = clientKind === 'native' ? await storage.getRefreshToken() : null;
        await request<void>('/auth/logout', {
          method: 'POST',
          body: { client: clientKind, ...(refreshToken ? { refreshToken } : {}) },
          auth: false,
        });
      },
      me: (): Promise<AccountDto> => request('/auth/me', { schema: accountSchema }),
    },
    supplierProfile: {
      get: (): Promise<SupplierProfileDto> =>
        request('/supplier-profile', { schema: supplierProfileSchema }),
      create: (body: CreateSupplierProfileRequest): Promise<SupplierProfileDto> =>
        request('/supplier-profile', { method: 'POST', body, schema: supplierProfileSchema }),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
