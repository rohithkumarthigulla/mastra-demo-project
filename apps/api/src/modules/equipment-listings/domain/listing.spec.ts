import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { nextStatus } from './listing';

describe('nextStatus', () => {
  it('allows only DRAFT→ACTIVE, INACTIVE→ACTIVE and ACTIVE→INACTIVE', () => {
    assert.equal(nextStatus('DRAFT', 'publish'), 'ACTIVE');
    assert.equal(nextStatus('INACTIVE', 'publish'), 'ACTIVE');
    assert.equal(nextStatus('ACTIVE', 'publish'), null);
    assert.equal(nextStatus('ACTIVE', 'deactivate'), 'INACTIVE');
    assert.equal(nextStatus('DRAFT', 'deactivate'), null);
    assert.equal(nextStatus('INACTIVE', 'deactivate'), null);
  });
});
