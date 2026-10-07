import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { Logger, NotFoundException, type ArgumentsHost } from '@nestjs/common';
import { z } from 'zod';
import { DomainError } from './domain-error';
import { AllExceptionsFilter } from './http-exception.filter';
import { ZodValidationPipe } from './zod-validation.pipe';

function run(exception: unknown): { status: number; body: Record<string, unknown> } {
  const sent: { status: number; body: Record<string, unknown> } = { status: 0, body: {} };
  const reply = {
    status(code: number) {
      sent.status = code;
      return {
        send(body: Record<string, unknown>) {
          sent.body = body;
        },
      };
    },
  };
  const host = { switchToHttp: () => ({ getResponse: () => reply }) } as unknown as ArgumentsHost;
  new AllExceptionsFilter().catch(exception, host);
  return sent;
}

describe('AllExceptionsFilter', () => {
  it('maps a DomainError to its status and {code, message}', () => {
    assert.deepEqual(run(new DomainError('booking_conflict', 'Already booked', 409)), {
      status: 409,
      body: { code: 'booking_conflict', message: 'Already booked' },
    });
  });

  it('passes validation errors through unchanged', () => {
    let thrown: unknown;
    try {
      new ZodValidationPipe(z.object({ name: z.string() })).transform({});
    } catch (error) {
      thrown = error;
    }
    const { status, body } = run(thrown);
    assert.equal(status, 400);
    assert.equal(body.code, 'validation_failed');
    assert.ok(Array.isArray(body.errors));
  });

  it('gives unstructured HttpExceptions a snake_case code', () => {
    const { status, body } = run(new NotFoundException('Cannot GET /nope'));
    assert.equal(status, 404);
    assert.deepEqual(body, { code: 'not_found', message: 'Cannot GET /nope' });
  });

  it('logs unknown errors and returns a generic 500 without leaking details', () => {
    const logged = mock.method(Logger.prototype, 'error', () => undefined);
    try {
      const error = new Error('secret connection string');
      const { status, body } = run(error);
      assert.equal(status, 500);
      assert.deepEqual(body, { code: 'internal_error', message: 'Internal server error' });
      assert.ok(!JSON.stringify(body).includes('secret'));
      assert.equal(logged.mock.callCount(), 1);
      assert.deepEqual(logged.mock.calls[0]?.arguments, [error.message, error.stack]);
    } finally {
      logged.mock.restore();
    }
  });
});
