import {
  LISTING_MEDIA_MIME_TYPES,
  MAX_LISTING_PHOTO_BYTES,
  MAX_LISTING_PHOTOS,
} from '@ee/contracts';

export interface PickedPhoto {
  name: string;
  type: string;
  /** Unknown on some platforms; the API still enforces the limit. */
  size?: number;
}

export interface PhotoCheck<T> {
  accepted: T[];
  rejected: { photo: T; reason: string }[];
}

const MAX_MB = Math.round(MAX_LISTING_PHOTO_BYTES / (1024 * 1024));

/**
 * Splits picked photos into those worth uploading and those that would be refused,
 * so one bad photo doesn't stop the rest.
 */
export function checkPhotos<T extends PickedPhoto>(
  photos: T[],
  existingCount: number,
): PhotoCheck<T> {
  const result: PhotoCheck<T> = { accepted: [], rejected: [] };
  let room = MAX_LISTING_PHOTOS - existingCount;
  for (const photo of photos) {
    if (!(LISTING_MEDIA_MIME_TYPES as readonly string[]).includes(photo.type)) {
      result.rejected.push({ photo, reason: `${photo.name}: only JPEG, PNG or WebP photos.` });
    } else if (photo.size !== undefined && photo.size > MAX_LISTING_PHOTO_BYTES) {
      result.rejected.push({ photo, reason: `${photo.name}: photos can be at most ${MAX_MB} MB.` });
    } else if (room <= 0) {
      result.rejected.push({
        photo,
        reason: `${photo.name}: a listing can have at most ${MAX_LISTING_PHOTOS} photos.`,
      });
    } else {
      result.accepted.push(photo);
      room -= 1;
    }
  }
  return result;
}

/** Moves the item at `from` to `to`, returning a new array. */
export function move<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  if (from < 0 || from >= next.length || to < 0 || to >= next.length) return next;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}
