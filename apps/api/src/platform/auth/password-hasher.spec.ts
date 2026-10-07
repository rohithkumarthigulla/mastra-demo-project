import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PasswordHasher } from './password-hasher';

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher();

  it('hashes with argon2id and verifies the original password only', async () => {
    const hash = await hasher.hash('correct horse battery');
    assert.match(hash, /^\$argon2id\$/);
    assert.ok(!hash.includes('correct horse battery'));
    assert.equal(await hasher.verify(hash, 'correct horse battery'), true);
    assert.equal(await hasher.verify(hash, 'wrong password'), false);
  });

  it('returns false for a malformed hash instead of throwing', async () => {
    assert.equal(await hasher.verify('not-a-hash', 'anything'), false);
  });
});
