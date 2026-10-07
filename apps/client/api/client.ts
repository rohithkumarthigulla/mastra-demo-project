import {
  accountSchema,
  authResponseSchema,
  equipmentCategorySchema,
  equipmentListingPageSchema,
  equipmentListingSchema,
  equipmentModelDetailSchema,
  equipmentModelPageSchema,
  listingMediaListSchema,
  listingMediaSchema,
  manufacturerSchema,
  publicReferenceSchema,
  specificationDefinitionSchema,
  supplierProfileSchema,
  type AccountDto,
  type AuthResponse,
  type BrowseListingsQuery,
  type ClientKind,
  type CreateListingRequest,
  type CreateSupplierProfileRequest,
  type EquipmentCategoryDto,
  type EquipmentListingDto,
  type EquipmentListingPageDto,
  type EquipmentModelDetailDto,
  type EquipmentModelPageDto,
  type ListingMediaDto,
  type ListingMediaListDto,
  type ListingStatus,
  type LoginRequest,
  type ManufacturerDto,
  type PublicReferenceDto,
  type RegisterRequest,
  type SpecificationDefinitionDto,
  type SupplierProfileDto,
  type UpdateListingRequest,
  type UpdateSupplierProfileRequest,
} from '@ee/contracts';
import { z, type ZodType } from 'zod';
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
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** JSON-encoded unless it is FormData, which fetch sends as multipart. */
  body?: unknown;
  schema?: ZodType<T>;
  /** Send the access token and refresh-and-retry once on 401. */
  auth?: boolean;
}

type WithoutClient<T> = Omit<T, 'client'>;

/** A photo picked on the device: a `uri` on native, a `File` on web. */
export type UploadFile = { uri: string; name: string; type: string } | Blob;

type QueryValue = string | number | undefined | null;

/** `?a=1&b=x` from the defined, non-empty values; '' when there are none. */
export function toQueryString(query: Record<string, QueryValue>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

export interface ModelSearch {
  category?: string;
  manufacturer?: string;
  model?: string;
  limit?: number;
  offset?: number;
}

export function createApiClient(options: ApiClientOptions) {
  const { baseUrl, storage, onSessionExpired } = options;
  const fetchImpl = options.fetch ?? fetch;
  const clientKind: ClientKind = storage.clientKind;

  let inflightRefresh: Promise<AuthResponse> | null = null;

  async function send(path: string, opts: RequestOptions<unknown>): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const multipart = opts.body instanceof FormData;
    // fetch sets the multipart boundary itself.
    if (opts.body !== undefined && !multipart) headers['Content-Type'] = 'application/json';
    const token = opts.auth === false ? null : storage.getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    return fetchImpl(`${baseUrl}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body:
        opts.body === undefined
          ? undefined
          : multipart
            ? (opts.body as FormData)
            : JSON.stringify(opts.body),
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

  const id = encodeURIComponent;

  return {
    clientKind,
    baseUrl,
    request,
    /** The current access token, refreshing first when there is none (e.g. web after reload). */
    accessToken: async (): Promise<string | null> => {
      const token = storage.getAccessToken();
      if (token) return token;
      try {
        return (await refreshOnce()).accessToken;
      } catch {
        return null;
      }
    },
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
      update: (body: UpdateSupplierProfileRequest): Promise<SupplierProfileDto> =>
        request('/supplier-profile', { method: 'PATCH', body, schema: supplierProfileSchema }),
    },
    supplierListings: {
      list: (
        query: { status?: ListingStatus; limit?: number; offset?: number } = {},
      ): Promise<EquipmentListingPageDto> =>
        request(`/supplier/listings${toQueryString(query)}`, {
          schema: equipmentListingPageSchema,
        }),
      get: (listingId: string): Promise<EquipmentListingDto> =>
        request(`/supplier/listings/${id(listingId)}`, { schema: equipmentListingSchema }),
      create: (body: CreateListingRequest): Promise<EquipmentListingDto> =>
        request('/supplier/listings', { method: 'POST', body, schema: equipmentListingSchema }),
      update: (listingId: string, body: UpdateListingRequest): Promise<EquipmentListingDto> =>
        request(`/supplier/listings/${id(listingId)}`, {
          method: 'PATCH',
          body,
          schema: equipmentListingSchema,
        }),
      publish: (listingId: string): Promise<EquipmentListingDto> =>
        request(`/supplier/listings/${id(listingId)}/publish`, {
          method: 'POST',
          schema: equipmentListingSchema,
        }),
      deactivate: (listingId: string): Promise<EquipmentListingDto> =>
        request(`/supplier/listings/${id(listingId)}/deactivate`, {
          method: 'POST',
          schema: equipmentListingSchema,
        }),
    },
    listingMedia: {
      upload: (listingId: string, file: UploadFile): Promise<ListingMediaDto> => {
        const form = new FormData();
        // React Native's FormData accepts `{ uri, name, type }`; web takes the File itself.
        form.append('file', file as Blob, file instanceof Blob ? undefined : file.name);
        return request(`/supplier/listings/${id(listingId)}/media`, {
          method: 'POST',
          body: form,
          schema: listingMediaSchema,
        });
      },
      reorder: (listingId: string, mediaIds: string[]): Promise<ListingMediaListDto> =>
        request(`/supplier/listings/${id(listingId)}/media/order`, {
          method: 'PUT',
          body: { mediaIds },
          schema: listingMediaListSchema,
        }),
      remove: (listingId: string, mediaId: string): Promise<void> =>
        request(`/supplier/listings/${id(listingId)}/media/${id(mediaId)}`, {
          method: 'DELETE',
        }),
    },
    listings: {
      browse: (query: Partial<BrowseListingsQuery> = {}): Promise<EquipmentListingPageDto> =>
        request(`/equipment-listings${toQueryString(query)}`, {
          schema: equipmentListingPageSchema,
          auth: false,
        }),
      get: (listingId: string): Promise<EquipmentListingDto> =>
        request(`/equipment-listings/${id(listingId)}`, {
          schema: equipmentListingSchema,
          auth: false,
        }),
    },
    knowledge: {
      models: (query: ModelSearch = {}): Promise<EquipmentModelPageDto> =>
        request(`/equipment-models${toQueryString({ ...query })}`, {
          schema: equipmentModelPageSchema,
          auth: false,
        }),
      model: (modelId: string): Promise<EquipmentModelDetailDto> =>
        request(`/equipment-models/${id(modelId)}`, {
          schema: equipmentModelDetailSchema,
          auth: false,
        }),
      manufacturers: (): Promise<ManufacturerDto[]> =>
        request('/manufacturers', { schema: z.array(manufacturerSchema), auth: false }),
      categories: (): Promise<EquipmentCategoryDto[]> =>
        request('/equipment-categories', {
          schema: z.array(equipmentCategorySchema),
          auth: false,
        }),
      specificationDefinitions: (): Promise<SpecificationDefinitionDto[]> =>
        request('/specification-definitions', {
          schema: z.array(specificationDefinitionSchema),
          auth: false,
        }),
    },
    reference: {
      get: (): Promise<PublicReferenceDto> =>
        request('/public/reference', { schema: publicReferenceSchema, auth: false }),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
