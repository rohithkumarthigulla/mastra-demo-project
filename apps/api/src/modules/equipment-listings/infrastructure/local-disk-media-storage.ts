import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ListingMediaStorage } from '../domain';

/** Server-generated keys only: a uuid plus a known image extension. */
const KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

export class LocalDiskMediaStorage implements ListingMediaStorage {
  private readonly root: string;
  private ready: Promise<unknown> | undefined;

  constructor(dir: string) {
    this.root = path.resolve(dir);
  }

  async put(key: string, data: Buffer): Promise<void> {
    const file = this.pathFor(key);
    this.ready ??= mkdir(this.root, { recursive: true });
    await this.ready;
    await writeFile(file, data, { flag: 'wx' });
  }

  async read(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.pathFor(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  private pathFor(key: string): string {
    if (!KEY_PATTERN.test(key)) throw new Error(`Invalid media storage key: ${key}`);
    return path.join(this.root, key);
  }
}
