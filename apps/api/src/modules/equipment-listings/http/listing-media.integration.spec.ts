import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { afterEach, describe, it } from 'node:test';
import { SUPPLIER_A, UNKNOWN_ID, closeApp, createApp } from '../testing/listings-test-app';

afterEach(closeApp);

const jpeg = (tag: string) =>
  Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(tag)]);
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('png body'),
]);
const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 body')]);

interface MediaBody {
  id: string;
  url: string;
  mimeType: string;
  position: number;
  originalFilename: string;
}

describe('listing photos (integration)', () => {
  it('uploads, reorders and serves photos in order once the listing is published', async () => {
    const http = await createApp();
    const listing = await http.createListing(http.supplierA);

    const uploaded: MediaBody[] = [];
    for (const [data, name] of [
      [jpeg('one'), 'one.jpg'],
      [png, 'two.png'],
      [webp, 'three.webp'],
    ] as const) {
      const res = await http.upload(listing.id, http.supplierA, data, name);
      assert.equal(res.statusCode, 201, res.body);
      uploaded.push(res.json<MediaBody>());
    }
    assert.deepEqual(
      uploaded.map((m) => [m.mimeType, m.position, m.originalFilename]),
      [
        ['image/jpeg', 0, 'one.jpg'],
        ['image/png', 1, 'two.png'],
        ['image/webp', 2, 'three.webp'],
      ],
    );
    const [first, second, third] = uploaded;
    assert.ok(first && second && third);
    assert.equal(first.url, `/equipment-listings/${listing.id}/media/${first.id}`);

    const newOrder = [third.id, first.id, second.id];
    const reorder = await http.request(
      'PUT',
      `/supplier/listings/${listing.id}/media/order`,
      http.supplierA,
      { mediaIds: newOrder },
    );
    assert.equal(reorder.statusCode, 200, reorder.body);
    assert.deepEqual(
      reorder.json<{ items: MediaBody[] }>().items.map((m) => m.id),
      newOrder,
    );

    // Hidden from the public while DRAFT, photos included.
    const draftPhoto = await http.request('GET', first.url);
    assert.equal(draftPhoto.statusCode, 404);
    assert.equal(draftPhoto.json().code, 'media_not_found');

    await http.request('POST', `/supplier/listings/${listing.id}/publish`, http.supplierA);
    const pub = await http.request('GET', `/equipment-listings/${listing.id}`);
    assert.equal(pub.statusCode, 200);
    const body = pub.json<{ photos: { id: string; url: string }[]; coverPhotoUrl: string }>();
    assert.deepEqual(
      body.photos.map((p) => p.id),
      newOrder,
    );
    assert.equal(body.coverPhotoUrl, `/equipment-listings/${listing.id}/media/${newOrder[0]}`);

    const served = await http.request('GET', body.coverPhotoUrl);
    assert.equal(served.statusCode, 200);
    assert.equal(served.headers['content-type'], 'image/webp');
    assert.equal(served.headers['x-content-type-options'], 'nosniff');
    assert.match(String(served.headers['cache-control']), /^public/);
    assert.deepEqual(served.rawPayload, webp);

    const browse = await http.request('GET', '/equipment-listings');
    const [browsed] = browse.json<{ items: { photos: { id: string }[] }[] }>().items;
    assert.deepEqual(
      browsed?.photos.map((p) => p.id),
      newOrder,
    );
  });

  it('rejects an 11th photo, oversized files and non-images disguised as .jpg', async () => {
    const http = await createApp();
    const listing = await http.createListing(http.supplierA);
    for (let i = 0; i < 10; i++) {
      const res = await http.upload(listing.id, http.supplierA, jpeg(`photo ${i}`));
      assert.equal(res.statusCode, 201, res.body);
    }
    const eleventh = await http.upload(listing.id, http.supplierA, jpeg('eleven'));
    assert.equal(eleventh.statusCode, 409);
    assert.equal(eleventh.json().code, 'media_limit_reached');

    const other = await http.createListing(http.supplierA);
    // The test app caps uploads at 64 KB.
    const huge = await http.upload(
      other.id,
      http.supplierA,
      Buffer.concat([jpeg('big'), Buffer.alloc(64 * 1024)]),
    );
    assert.equal(huge.statusCode, 413);
    assert.equal(huge.json().code, 'media_too_large');

    const text = await http.upload(
      other.id,
      http.supplierA,
      Buffer.from('just some text'),
      'cat.jpg',
    );
    assert.equal(text.statusCode, 415);
    assert.equal(text.json().code, 'unsupported_media_type');

    const noFile = await http.request(
      'POST',
      `/supplier/listings/${other.id}/media`,
      http.supplierA,
      {},
    );
    assert.equal(noFile.statusCode, 400);

    assert.equal(http.mediaRepo.photosFor(other.id).length, 0);
    // Only the ten accepted photos were written to disk.
    assert.equal((await readdir(http.mediaDir)).length, 10);
  });

  it('deletes a photo row and file and closes the gap in positions', async () => {
    const http = await createApp();
    const listing = await http.createListing(http.supplierA);
    const ids: string[] = [];
    for (const tag of ['a', 'b', 'c']) {
      ids.push((await http.upload(listing.id, http.supplierA, jpeg(tag))).json<MediaBody>().id);
    }

    const del = await http.request(
      'DELETE',
      `/supplier/listings/${listing.id}/media/${ids[0]}`,
      http.supplierA,
    );
    assert.equal(del.statusCode, 204);
    assert.equal((await readdir(http.mediaDir)).length, 2);
    assert.deepEqual(
      http.mediaRepo.photosFor(listing.id).map((p) => [p.id, p.position]),
      [
        [ids[1], 0],
        [ids[2], 1],
      ],
    );

    const again = await http.request(
      'DELETE',
      `/supplier/listings/${listing.id}/media/${ids[0]}`,
      http.supplierA,
    );
    assert.equal(again.statusCode, 404);
    assert.equal(again.json().code, 'media_not_found');
  });

  it('requires the order to list exactly the current photos', async () => {
    const http = await createApp();
    const listing = await http.createListing(http.supplierA);
    const ids: string[] = [];
    for (const tag of ['a', 'b']) {
      ids.push((await http.upload(listing.id, http.supplierA, jpeg(tag))).json<MediaBody>().id);
    }
    const url = `/supplier/listings/${listing.id}/media/order`;
    for (const mediaIds of [[ids[0]], [ids[0], ids[0]], [...ids, UNKNOWN_ID], []]) {
      const res = await http.request('PUT', url, http.supplierA, { mediaIds });
      assert.equal(res.statusCode, 400, JSON.stringify(mediaIds));
    }
    const bad = await http.request('PUT', url, http.supplierA, { mediaIds: ['not-a-uuid'] });
    assert.equal(bad.statusCode, 400);
  });

  it('restricts photo management to the owning supplier', async () => {
    const http = await createApp();
    const listing = await http.createListing(http.supplierA);
    const photo = (await http.upload(listing.id, http.supplierA, jpeg('a'))).json<MediaBody>();
    const base = `/supplier/listings/${listing.id}/media`;

    assert.equal((await http.upload(listing.id, undefined, jpeg('x'))).statusCode, 401);
    assert.equal(
      (await http.upload(listing.id, http.tokenFor('BUILDER'), jpeg('x'))).statusCode,
      403,
    );
    assert.equal((await http.request('DELETE', `${base}/${photo.id}`)).statusCode, 401);
    assert.equal(
      (await http.request('PUT', `${base}/order`, http.tokenFor('BUILDER'), { mediaIds: [] }))
        .statusCode,
      403,
    );

    const other = await http.upload(listing.id, http.supplierB, jpeg('x'));
    assert.equal(other.statusCode, 404);
    assert.equal(other.json().code, 'listing_not_found');
    assert.equal(
      (await http.request('DELETE', `${base}/${photo.id}`, http.supplierB)).statusCode,
      404,
    );
    assert.equal(
      (await http.request('PUT', `${base}/order`, http.supplierB, { mediaIds: [photo.id] }))
        .statusCode,
      404,
    );
    assert.equal(
      (await http.request('DELETE', `${base}/not-a-uuid`, http.supplierA)).statusCode,
      404,
    );
  });

  it('serves DRAFT and INACTIVE photos only to their owner', async () => {
    const http = await createApp();
    const listing = await http.createListing(http.supplierA);
    const photo = (await http.upload(listing.id, http.supplierA, jpeg('a'))).json<MediaBody>();

    const owner = await http.request('GET', photo.url, http.supplierA);
    assert.equal(owner.statusCode, 200);
    assert.match(String(owner.headers['cache-control']), /private/);

    assert.equal((await http.request('GET', photo.url)).statusCode, 404);
    assert.equal((await http.request('GET', photo.url, 'not-a-jwt')).statusCode, 404);
    assert.equal((await http.request('GET', photo.url, http.supplierB)).statusCode, 404);
    assert.equal(
      (await http.request('GET', photo.url, http.tokenFor('BUILDER', SUPPLIER_A))).statusCode,
      404,
    );

    await http.request('POST', `/supplier/listings/${listing.id}/publish`, http.supplierA);
    assert.equal((await http.request('GET', photo.url)).statusCode, 200);
    await http.request('POST', `/supplier/listings/${listing.id}/deactivate`, http.supplierA);
    assert.equal((await http.request('GET', photo.url)).statusCode, 404);
    assert.equal((await http.request('GET', photo.url, http.supplierA)).statusCode, 200);

    // A photo id only resolves under its own listing.
    const elsewhere = await http.createPublished(http.supplierA);
    assert.equal(
      (await http.request('GET', `/equipment-listings/${elsewhere.id}/media/${photo.id}`))
        .statusCode,
      404,
    );
    assert.equal(
      (await http.request('GET', `/equipment-listings/${listing.id}/media/..%2F..%2Fetc`))
        .statusCode,
      404,
    );
  });

  it('never uses the client filename as a storage path', async () => {
    const http = await createApp();
    const listing = await http.createListing(http.supplierA);
    const res = await http.upload(listing.id, http.supplierA, png, '../../escape.png');
    assert.equal(res.statusCode, 201, res.body);
    const files = await readdir(http.mediaDir);
    assert.equal(files.length, 1);
    assert.match(files[0] ?? '', /^[0-9a-f-]{36}\.png$/);
  });
});
