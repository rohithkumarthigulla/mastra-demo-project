import { MAX_LISTING_PHOTO_BYTES } from '@ee/contracts';
import { describe, expect, it } from 'vitest';
import { checkPhotos, move } from './photos';

const photo = (name: string, size = 1000, type = 'image/jpeg') => ({ name, size, type });

describe('checkPhotos', () => {
  it('rejects an oversized photo but keeps the others', () => {
    const big = photo('big.jpg', MAX_LISTING_PHOTO_BYTES + 1);
    const result = checkPhotos([photo('a.jpg'), big, photo('b.png', 10, 'image/png')], 0);
    expect(result.accepted.map((p) => p.name)).toEqual(['a.jpg', 'b.png']);
    expect(result.rejected).toEqual([
      { photo: big, reason: 'big.jpg: photos can be at most 8 MB.' },
    ]);
  });

  it('rejects unsupported types', () => {
    const result = checkPhotos([photo('a.gif', 10, 'image/gif')], 0);
    expect(result.rejected[0]?.reason).toMatch(/JPEG, PNG or WebP/);
  });

  it('stops at the photo limit', () => {
    const result = checkPhotos([photo('a.jpg'), photo('b.jpg'), photo('c.jpg')], 8);
    expect(result.accepted.map((p) => p.name)).toEqual(['a.jpg', 'b.jpg']);
    expect(result.rejected[0]?.reason).toMatch(/at most 10 photos/);
  });

  it('lets the API judge photos of unknown size', () => {
    expect(checkPhotos([{ name: 'x.jpg', type: 'image/jpeg' }], 0).accepted).toHaveLength(1);
  });
});

describe('move', () => {
  it('moves an item without mutating the input', () => {
    const items = ['a', 'b', 'c'];
    expect(move(items, 2, 0)).toEqual(['c', 'a', 'b']);
    expect(items).toEqual(['a', 'b', 'c']);
  });
  it('ignores out-of-range moves', () => {
    expect(move(['a', 'b'], 0, 5)).toEqual(['a', 'b']);
  });
});
