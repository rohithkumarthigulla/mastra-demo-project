import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

const pipe = new ZodValidationPipe(
  z.object({
    name: z.string().min(1),
    count: z.coerce.number().int().default(1),
    address: z.object({ city: z.string() }),
  }),
);

describe('ZodValidationPipe', () => {
  it('returns the parsed value with coercions and defaults applied', () => {
    assert.deepEqual(pipe.transform({ name: 'crane', count: '3', address: { city: 'Leeds' } }), {
      name: 'crane',
      count: 3,
      address: { city: 'Leeds' },
    });
    assert.equal(pipe.transform({ name: 'crane', address: { city: 'Leeds' } }).count, 1);
  });

  it('throws a 400 listing every invalid field with dotted paths', () => {
    assert.throws(
      () => pipe.transform({ name: '', address: {} }),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestException);
        assert.equal(error.getStatus(), 400);
        const body = error.getResponse() as {
          code: string;
          errors: { path: string; message: string }[];
        };
        assert.equal(body.code, 'validation_failed');
        assert.deepEqual(body.errors.map((e) => e.path).sort(), ['address.city', 'name']);
        return true;
      },
    );
  });
});
