import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import { MAX_LISTING_PHOTOS } from '@ee/contracts';
import { CLOCK, type AuthUser, type Clock } from '../../../platform/auth';
import {
  EQUIPMENT_LISTING_REPOSITORY,
  InvalidMediaOrderError,
  LISTING_MEDIA_REPOSITORY,
  LISTING_MEDIA_STORAGE,
  MEDIA_EXTENSIONS,
  MediaLimitReachedError,
  MediaNotFoundError,
  UnsupportedMediaTypeError,
  detectImageType,
  type EquipmentListingRepository,
  type ListingMedia,
  type ListingMediaRepository,
  type ListingMediaStorage,
  type ListingStatus,
} from '../domain';
import { EquipmentListingsService } from './equipment-listings.service';

export interface UploadedFile {
  filename: string;
  data: Buffer;
}

export interface MediaContent {
  media: ListingMedia;
  data: Buffer;
  listingStatus: ListingStatus;
}

@Injectable()
export class ListingMediaService {
  constructor(
    private readonly listings: EquipmentListingsService,
    @Inject(EQUIPMENT_LISTING_REPOSITORY) private readonly listingRepo: EquipmentListingRepository,
    @Inject(LISTING_MEDIA_REPOSITORY) private readonly media: ListingMediaRepository,
    @Inject(LISTING_MEDIA_STORAGE) private readonly storage: ListingMediaStorage,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async upload(accountId: string, listingId: string, file: UploadedFile): Promise<ListingMedia> {
    await this.listings.getOwn(accountId, listingId);
    // The bytes decide the type; the client's filename and content type are ignored.
    const mimeType = detectImageType(file.data);
    if (!mimeType) throw new UnsupportedMediaTypeError();
    // Cheap early rejection; the repository enforces the cap again under a lock.
    const existing = await this.media.listForListing(listingId);
    if (existing.length >= MAX_LISTING_PHOTOS) throw new MediaLimitReachedError(MAX_LISTING_PHOTOS);

    const storageKey = `${randomUUID()}.${MEDIA_EXTENSIONS[mimeType]}`;
    await this.storage.put(storageKey, file.data);
    try {
      return await this.media.insert(
        {
          listingId,
          storageKey,
          originalFilename: path.basename(file.filename).slice(0, 255) || 'photo',
          mimeType,
          sizeBytes: file.data.length,
        },
        MAX_LISTING_PHOTOS,
        this.clock.now(),
      );
    } catch (error) {
      await this.storage.remove(storageKey);
      throw error;
    }
  }

  async remove(accountId: string, listingId: string, mediaId: string): Promise<void> {
    await this.listings.getOwn(accountId, listingId);
    const deleted = await this.media.delete(listingId, mediaId, this.clock.now());
    if (!deleted) throw new MediaNotFoundError();
    await this.storage.remove(deleted.storageKey);
  }

  async reorder(accountId: string, listingId: string, mediaIds: string[]): Promise<ListingMedia[]> {
    await this.listings.getOwn(accountId, listingId);
    if (!(await this.media.reorder(listingId, mediaIds, this.clock.now()))) {
      throw new InvalidMediaOrderError();
    }
    return this.media.listForListing(listingId);
  }

  /** Anyone may see photos of ACTIVE listings; otherwise only the owning supplier. */
  async open(listingId: string, mediaId: string, viewer?: AuthUser): Promise<MediaContent> {
    const listing =
      (await this.listingRepo.findView(listingId, { publicOnly: true })) ??
      (await this.ownedBy(listingId, viewer));
    if (!listing) throw new MediaNotFoundError();
    const media = await this.media.find(listingId, mediaId);
    if (!media) throw new MediaNotFoundError();
    const data = await this.storage.read(media.storageKey);
    if (!data) throw new MediaNotFoundError();
    return { media, data, listingStatus: listing.status };
  }

  private async ownedBy(listingId: string, viewer?: AuthUser) {
    if (viewer?.role !== 'SUPPLIER') return null;
    const profileId = await this.listingRepo.findSupplierProfileId(viewer.accountId);
    if (!profileId) return null;
    return this.listingRepo.findView(listingId, { supplierProfileId: profileId });
  }
}
