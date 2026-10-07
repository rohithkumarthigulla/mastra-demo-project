export const LISTING_MEDIA_STORAGE = Symbol('LISTING_MEDIA_STORAGE');

/** Where photo bytes live. Keys are server-generated; swap the implementation for cloud storage. */
export interface ListingMediaStorage {
  put(key: string, data: Buffer): Promise<void>;
  /** The stored bytes, or null if nothing is stored under the key. */
  read(key: string): Promise<Buffer | null>;
  /** Removing a missing key is not an error. */
  remove(key: string): Promise<void>;
}
