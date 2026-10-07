import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { Body, Controller, Module, Post } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { z } from 'zod';
import { AllExceptionsFilter } from './http-exception.filter';
import { ZodValidationPipe } from './zod-validation.pipe';

const echoSchema = z.object({ name: z.string() });

@Controller('echo')
class EchoController {
  @Post()
  echo(@Body(new ZodValidationPipe(echoSchema)) body: z.infer<typeof echoSchema>) {
    return body;
  }
}

@Module({ controllers: [EchoController] })
class EchoModule {}

describe('HTTP plumbing (in-process)', () => {
  let app: NestFastifyApplication;

  before(async () => {
    app = await NestFactory.create<NestFastifyApplication>(EchoModule, new FastifyAdapter(), {
      logger: false,
    });
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  after(async () => {
    await app.close();
  });

  it('rejects an invalid body with 400 and field errors', async () => {
    const res = await app
      .getHttpAdapter()
      .getInstance()
      .inject({ method: 'POST', url: '/echo', payload: {} });
    assert.equal(res.statusCode, 400);
    const body = res.json();
    assert.equal(body.code, 'validation_failed');
    assert.equal(body.errors[0].path, 'name');
  });

  it('accepts a valid body', async () => {
    const res = await app
      .getHttpAdapter()
      .getInstance()
      .inject({ method: 'POST', url: '/echo', payload: { name: 'excavator' } });
    assert.equal(res.statusCode, 201);
    assert.deepEqual(res.json(), { name: 'excavator' });
  });

  it('shapes unknown routes as {code, message}', async () => {
    const res = await app.getHttpAdapter().getInstance().inject({ method: 'GET', url: '/nope' });
    assert.equal(res.statusCode, 404);
    assert.equal(res.json().code, 'not_found');
  });
});
