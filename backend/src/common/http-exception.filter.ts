import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

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

      const body =
        typeof res === 'object' && res !== null
          ? res
          : {
              statusCode: status,
              message: res,
              ...(typeof (exception as { errorCode?: unknown }).errorCode !==
                'undefined' && {
                errorCode: (exception as { errorCode?: unknown }).errorCode,
              }),
            };
      if (!response.headersSent) {
        response.status(status).json(body);
      }
      return;
    }

    const method = request?.method ?? 'UNKNOWN';
    const url =
      (request as { originalUrl?: string })?.originalUrl ??
      request?.url ??
      'unknown';
    const stack =
      exception instanceof Error ? exception.stack : String(exception);
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
