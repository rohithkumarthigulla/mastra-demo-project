import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EnvError, parseEnv } from './env';

const DATABASE_URL = 'postgres://ee:ee@localhost:5432/ee';
const JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long';
const base = { DATABASE_URL, JWT_SECRET };

describe('parseEnv', () => {
  it('rejects a missing DATABASE_URL and names it', () => {
    assert.throws(
      () => parseEnv({ JWT_SECRET }),
      (error: unknown) => {
        assert.ok(error instanceof EnvError);
        assert.match(error.message, /DATABASE_URL/);
        return true;
      },
    );
  });

  it('rejects a malformed DATABASE_URL', () => {
    assert.throws(() => parseEnv({ JWT_SECRET, DATABASE_URL: 'not a url' }), /DATABASE_URL/);
  });

  it('rejects a missing or short JWT_SECRET and names it', () => {
    assert.throws(() => parseEnv({ DATABASE_URL }), /JWT_SECRET/);
    assert.throws(() => parseEnv({ DATABASE_URL, JWT_SECRET: 'short' }), /JWT_SECRET/);
  });

  it('defaults NODE_ENV to development', () => {
    assert.equal(parseEnv(base).NODE_ENV, 'development');
    assert.equal(parseEnv({ ...base, NODE_ENV: 'production' }).NODE_ENV, 'production');
  });

  it('defaults PORT to 3000 and coerces it from a string', () => {
    assert.equal(parseEnv(base).PORT, 3000);
    assert.equal(parseEnv({ ...base, PORT: '8080' }).PORT, 8080);
  });

  it('rejects a non-numeric PORT', () => {
    assert.throws(() => parseEnv({ ...base, PORT: 'abc' }), /PORT/);
  });

  it('splits CORS_ORIGINS on commas and drops blanks', () => {
    assert.deepEqual(parseEnv({ ...base, CORS_ORIGINS: 'a, b,' }).CORS_ORIGINS, ['a', 'b']);
    assert.deepEqual(parseEnv(base).CORS_ORIGINS, []);
  });
});
