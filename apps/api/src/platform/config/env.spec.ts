import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EnvError, parseEnv } from './env';

const DATABASE_URL = 'postgres://ee:ee@localhost:5432/ee';

describe('parseEnv', () => {
  it('rejects a missing DATABASE_URL and names it', () => {
    assert.throws(
      () => parseEnv({}),
      (error: unknown) => {
        assert.ok(error instanceof EnvError);
        assert.match(error.message, /DATABASE_URL/);
        return true;
      },
    );
  });

  it('rejects a malformed DATABASE_URL', () => {
    assert.throws(() => parseEnv({ DATABASE_URL: 'not a url' }), /DATABASE_URL/);
  });

  it('defaults PORT to 3000 and coerces it from a string', () => {
    assert.equal(parseEnv({ DATABASE_URL }).PORT, 3000);
    assert.equal(parseEnv({ DATABASE_URL, PORT: '8080' }).PORT, 8080);
  });

  it('rejects a non-numeric PORT', () => {
    assert.throws(() => parseEnv({ DATABASE_URL, PORT: 'abc' }), /PORT/);
  });

  it('splits CORS_ORIGINS on commas and drops blanks', () => {
    assert.deepEqual(parseEnv({ DATABASE_URL, CORS_ORIGINS: 'a, b,' }).CORS_ORIGINS, ['a', 'b']);
    assert.deepEqual(parseEnv({ DATABASE_URL }).CORS_ORIGINS, []);
  });
});
