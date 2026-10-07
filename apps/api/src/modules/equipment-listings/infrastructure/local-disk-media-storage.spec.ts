import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { LocalDiskMediaStorage } from './local-disk-media-storage';

const KEY = '0f8c2b1e-6a3d-4c55-9e7a-1b2c3d4e5f60.jpg';

describe('LocalDiskMediaStorage', () => {
  it('round-trips files and creates the directory on first write', async () => {
    const root = await mkdtemp(join(tmpdir(), 'media-storage-'));
    try {
      const storage = new LocalDiskMediaStorage(join(root, 'nested', 'dir'));
      assert.equal(await storage.read(KEY), null);
      await storage.put(KEY, Buffer.from('bytes'));
      assert.deepEqual(await storage.read(KEY), Buffer.from('bytes'));
      await storage.remove(KEY);
      assert.equal(await storage.read(KEY), null);
      await storage.remove(KEY);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('refuses keys that are not server-generated', async () => {
    const storage = new LocalDiskMediaStorage(tmpdir());
    for (const key of [
      '../escape.jpg',
      'photo.jpg',
      `${KEY}/../x.jpg`,
      KEY.replace('.jpg', '.exe'),
    ]) {
      await assert.rejects(storage.put(key, Buffer.from('x')), key);
      await assert.rejects(storage.read(key), key);
    }
  });
});
