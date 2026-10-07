import { type PipeTransform } from '@nestjs/common';
import type { EquipmentListingDto, EquipmentListingPageDto } from '@ee/contracts';
import { z } from 'zod';
import { ListingNotFoundError, type ListingPageResult, type ListingView } from '../domain';

/** A malformed id can never match a listing, so it is a 404 rather than a 400. */
export class ListingIdPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    const parsed = z.uuid().safeParse(value);
    if (!parsed.success) throw new ListingNotFoundError();
    return parsed.data;
  }
}

export function photoUrl(listingId: string, mediaId: string): string {
  return `/equipment-listings/${listingId}/media/${mediaId}`;
}

export function toListingDto(view: ListingView): EquipmentListingDto {
  const photos = view.photos.map((photo) => ({
    id: photo.id,
    url: photoUrl(view.id, photo.id),
    mimeType: photo.mimeType,
    position: photo.position,
  }));
  return {
    id: view.id,
    status: view.status,
    title: view.title,
    description: view.description,
    location: view.location,
    pricePerDay: view.pricePerDay,
    model: view.model,
    city: view.city,
    supplier: view.supplier,
    photos,
    coverPhotoUrl: photos[0]?.url ?? null,
    createdAt: view.createdAt.toISOString(),
    updatedAt: view.updatedAt.toISOString(),
  };
}

export function toListingPageDto(
  result: ListingPageResult,
  page: { limit: number; offset: number },
): EquipmentListingPageDto {
  return {
    items: result.items.map(toListingDto),
    total: result.total,
    limit: page.limit,
    offset: page.offset,
  };
}
