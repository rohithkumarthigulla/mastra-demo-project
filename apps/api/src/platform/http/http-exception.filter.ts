import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { createLogger } from '../logging';
import { DomainError } from './domain-error';

export interface ErrorBody {
  code: string;
  message: string;
  [key: string]: unknown;
}

interface Reply {
  status(code: number): { send(body: unknown): unknown };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = createLogger('HttpExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<Reply>();
    const { status, body } = this.toResponse(exception);
    reply.status(status).send(body);
  }

  private toResponse(exception: unknown): { status: number; body: ErrorBody } {
    if (exception instanceof DomainError) {
      return {
        status: exception.status,
        body: { code: exception.code, message: exception.message },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'object' && response !== null && 'code' in response) {
        return { status, body: response as ErrorBody };
      }
      const name = HttpStatus[status];
      return {
        status,
        body: {
          code: name ? name.toLowerCase() : 'http_error',
          message: exception.message,
        },
      };
    }

    const error = exception instanceof Error ? exception : new Error(String(exception));
    this.logger.error(error.message, error.stack);
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { code: 'internal_error', message: 'Internal server error' },
    };
  }
}
