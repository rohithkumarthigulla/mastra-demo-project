import { Inject, Injectable } from '@nestjs/common';
import type {
  BrowseListingsQuery,
  CreateListingRequest,
  ListSupplierListingsQuery,
  UpdateListingRequest,
} from '@ee/contracts';
import { CLOCK, type Clock } from '../../../platform/auth';
import {
  EQUIPMENT_LISTING_REPOSITORY,
  InvalidCityError,
  InvalidListingTransitionError,
  InvalidModelError,
  ListingNotFoundError,
  SupplierProfileRequiredError,
  nextStatus,
  type EquipmentListingRepository,
  type ListingAction,
  type ListingFields,
  type ListingPageResult,
  type ListingView,
} from '../domain';

@Injectable()
export class EquipmentListingsService {
  constructor(
    @Inject(EQUIPMENT_LISTING_REPOSITORY) private readonly listings: EquipmentListingRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async requireProfile(accountId: string): Promise<string> {
    const profileId = await this.listings.findSupplierProfileId(accountId);
    if (!profileId) throw new SupplierProfileRequiredError();
    return profileId;
  }

  async listOwn(accountId: string, query: ListSupplierListingsQuery): Promise<ListingPageResult> {
    return this.listings.listForSupplier(await this.requireProfile(accountId), query);
  }

  async getOwn(accountId: string, id: string): Promise<ListingView> {
    const view = await this.listings.findView(id, {
      supplierProfileId: await this.requireProfile(accountId),
    });
    if (!view) throw new ListingNotFoundError();
    return view;
  }

  async create(accountId: string, request: CreateListingRequest): Promise<ListingView> {
    const profileId = await this.requireProfile(accountId);
    const { cityGeoId, ...rest } = request;
    const fields: ListingFields = { ...rest, cityId: await this.resolveCity(cityGeoId) };
    await this.requireActiveModel(fields.modelId);
    const id = await this.listings.create(profileId, fields, this.clock.now());
    return this.getOwn(accountId, id);
  }

  async update(accountId: string, id: string, request: UpdateListingRequest): Promise<ListingView> {
    const profileId = await this.requireProfile(accountId);
    const { cityGeoId, ...patch } = request;
    const fields: Partial<ListingFields> = { ...patch };
    if (cityGeoId !== undefined) fields.cityId = await this.resolveCity(cityGeoId);
    if (fields.modelId !== undefined) await this.requireActiveModel(fields.modelId);
    if (!(await this.listings.update(id, profileId, fields, this.clock.now()))) {
      throw new ListingNotFoundError();
    }
    return this.getOwn(accountId, id);
  }

  publish(accountId: string, id: string): Promise<ListingView> {
    return this.transition(accountId, id, 'publish');
  }

  deactivate(accountId: string, id: string): Promise<ListingView> {
    return this.transition(accountId, id, 'deactivate');
  }

  async getPublic(id: string): Promise<ListingView> {
    const view = await this.listings.findView(id, { publicOnly: true });
    if (!view) throw new ListingNotFoundError();
    return view;
  }

  browse(query: BrowseListingsQuery): Promise<ListingPageResult> {
    return this.listings.browse({
      cityGeoId: query.city,
      categoryCode: query.category,
      modelId: query.modelId,
      manufacturerId: query.manufacturer,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      q: query.q,
      limit: query.limit,
      offset: query.offset,
    });
  }

  private async transition(
    accountId: string,
    id: string,
    action: ListingAction,
  ): Promise<ListingView> {
    const profileId = await this.requireProfile(accountId);
    const current = await this.listings.findView(id, { supplierProfileId: profileId });
    if (!current) throw new ListingNotFoundError();
    const to = nextStatus(current.status, action);
    if (!to) throw new InvalidListingTransitionError(action, current.status);
    const changed = await this.listings.setStatus(
      id,
      profileId,
      current.status,
      to,
      this.clock.now(),
    );
    // Someone else changed the status between our read and write.
    if (!changed) {
      const latest = await this.getOwn(accountId, id);
      throw new InvalidListingTransitionError(action, latest.status);
    }
    return this.getOwn(accountId, id);
  }

  private async resolveCity(geoId: string): Promise<string> {
    const cityId = await this.listings.findEnabledCityId(geoId);
    if (!cityId) throw new InvalidCityError();
    return cityId;
  }

  private async requireActiveModel(modelId: string): Promise<void> {
    if (!(await this.listings.isActiveModel(modelId))) throw new InvalidModelError();
  }
}
