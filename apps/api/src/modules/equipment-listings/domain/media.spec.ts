import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isPermutation } from './media';
import { detectImageType } from './media-type';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')]);

describe('detectImageType', () => {
  it('recognises JPEG, PNG and WebP by their leading bytes', () => {
    assert.equal(detectImageType(JPEG), 'image/jpeg');
    assert.equal(detectImageType(PNG), 'image/png');
    assert.equal(detectImageType(WEBP), 'image/webp');
  });

  it('rejects text, empty and truncated files', () => {
    assert.equal(detectImageType(Buffer.from('just some text, named photo.jpg')), null);
    assert.equal(detectImageType(Buffer.alloc(0)), null);
    assert.equal(detectImageType(PNG.subarray(0, 4)), null);
    assert.equal(detectImageType(WEBP.subarray(0, 10)), null);
    assert.equal(
      detectImageType(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE')])),
      null,
    );
  });
});

describe('isPermutation', () => {
  it('accepts only every current id exactly once', () => {
    assert.equal(isPermutation(['b', 'a'], ['a', 'b']), true);
    assert.equal(isPermutation([], []), true);
    assert.equal(isPermutation(['a'], ['a', 'b']), false);
    assert.equal(isPermutation(['a', 'b', 'c'], ['a', 'b']), false);
    assert.equal(isPermutation(['a', 'a'], ['a', 'b']), false);
    assert.equal(isPermutation(['a', 'c'], ['a', 'b']), false);
  });
});
