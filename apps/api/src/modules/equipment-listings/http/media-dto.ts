import type { PipeTransform } from '@nestjs/common';
import type { ListingMediaDto, ListingMediaListDto } from '@ee/contracts';
import { z } from 'zod';
import { MediaNotFoundError, type ListingMedia } from '../domain';
import { photoUrl } from './dto';

/** A malformed photo id can never match, so it is a 404 rather than a 400. */
export class MediaIdPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    const parsed = z.uuid().safeParse(value);
    if (!parsed.success) throw new MediaNotFoundError();
    return parsed.data;
  }
}

export function toMediaDto(media: ListingMedia): ListingMediaDto {
  return {
    id: media.id,
    url: photoUrl(media.listingId, media.id),
    originalFilename: media.originalFilename,
    mimeType: media.mimeType,
    sizeBytes: media.sizeBytes,
    position: media.position,
    createdAt: media.createdAt.toISOString(),
  };
}

export function toMediaListDto(items: ListingMedia[]): ListingMediaListDto {
  return { items: items.map(toMediaDto) };
}
