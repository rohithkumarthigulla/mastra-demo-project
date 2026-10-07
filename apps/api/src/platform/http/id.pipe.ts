import { Injectable, type PipeTransform } from '@nestjs/common';
import { z } from 'zod';
import { NotFoundError } from './domain-error';

/** A malformed id can never match, so it is a 404 rather than a 400. */
@Injectable()
export class IdPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    const parsed = z.uuid().safeParse(value);
    if (!parsed.success) throw new NotFoundError('not_found', 'Resource not found');
    return parsed.data;
  }
}
