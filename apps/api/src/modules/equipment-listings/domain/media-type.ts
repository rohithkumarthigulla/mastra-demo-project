import type { ListingMediaMimeType } from '@ee/contracts';

const startsWith = (head: Buffer, bytes: number[], offset = 0): boolean =>
  head.length >= offset + bytes.length && bytes.every((b, i) => head[offset + i] === b);

const ascii = (text: string): number[] => [...text].map((c) => c.charCodeAt(0));

/**
 * The image type from the file's leading bytes, or null if it is not a JPEG, PNG or WebP.
 * The filename and the declared content type are never trusted.
 */
export function detectImageType(head: Buffer): ListingMediaMimeType | null {
  if (startsWith(head, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(head, ascii('RIFF')) && startsWith(head, ascii('WEBP'), 8)) return 'image/webp';
  return null;
}

export const MEDIA_EXTENSIONS: Record<ListingMediaMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
