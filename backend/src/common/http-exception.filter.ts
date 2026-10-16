import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * L1 global exception filter — non-breaking by design.
 *
 * - `HttpException`s pass through BYTE-IDENTICAL (same status + same body as
 *   Nest's default `BaseExceptionFilter`): object bodies are re-emitted as-is,
 *   string bodies are wrapped as `{ statusCode, message }`. E2E contracts
 *   (e.g. `{ reason: 'DUPLICATE_REQUEST' }`) are therefore untouched.
 * - ONLY non-HTTP throwables are reshaped into a structured 500
 *   `{ statusCode: 500, message: 'Internal server error', requestId?, timestamp }`
 *   so stack traces never leak to clients. The original error (with stack) is
 *   logged server-side via Nest `Logger` together with method+url.
 */
@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      // Mirror BaseExceptionFilter byte-for-byte: objects pass through as-is,
      // string bodies become { statusCode, message }.
      const body =
        typeof res === 'object' && res !== null
          ? res
          : {
              statusCode: status,
              message: res,
              ...(typeof (exception as { errorCode?: unknown }).errorCode !== 'undefined' && {
                errorCode: (exception as { errorCode?: unknown }).errorCode,
              }),
            };
      if (!response.headersSent) {
        response.status(status).json(body);
      }
      return;
    }

    const method = request?.method ?? 'UNKNOWN';
    const url = (request as { originalUrl?: string })?.originalUrl ?? request?.url ?? 'unknown';
    const stack = exception instanceof Error ? exception.stack : String(exception);
    this.logger.error(`${method} ${url} — unhandled error`, stack);

    const headers = request?.headers ?? {};
    const headerId = headers['x-request-id'] ?? headers['x-correlation-id'];
    const requestId = Array.isArray(headerId) ? headerId[0] : headerId;

    const body: Record<string, unknown> = {
      statusCode: 500,
      message: 'Internal server error',
      timestamp: new Date().toISOString(),
    };
    if (typeof requestId === 'string' && requestId.length > 0) {
      body.requestId = requestId;
    }

    if (!response.headersSent) {
      response.status(500).json(body);
    }
  }
}
