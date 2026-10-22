import type { ArgumentsHost } from '@nestjs/common';
import {
  HttpException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { GlobalHttpExceptionFilter } from './http-exception.filter.js';

function mockHost(
  opts: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
  } = {},
) {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const response = { status, headersSent: false };
  const request = {
    method: opts.method ?? 'POST',
    url: opts.url ?? '/attendance/check-in',
    headers: opts.headers ?? {},
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('GlobalHttpExceptionFilter', () => {
  it('passes HttpException through untouched (same status + same body)', () => {
    const filter = new GlobalHttpExceptionFilter();
    const { host, status, json } = mockHost();

    const body = {
      reason: 'DUPLICATE_REQUEST',
      message: 'Request sudah diproses',
    };
    filter.catch(new UnprocessableEntityException(body), host);
    expect(status).toHaveBeenCalledWith(422);
    expect(json).toHaveBeenCalledWith(body);
    expect(json.mock.calls[0][0]).toBe(body);

    const { host: h2, status: s2, json: j2 } = mockHost();
    filter.catch(new NotFoundException('Attendance not found'), h2);
    expect(s2).toHaveBeenCalledWith(404);
    expect(j2).toHaveBeenCalledWith({
      statusCode: 404,
      message: 'Attendance not found',
      error: 'Not Found',
    });
  });

  it('wraps string-bodied HttpException exactly like the Nest default', () => {
    const filter = new GlobalHttpExceptionFilter();
    const { host, status, json } = mockHost();
    filter.catch(new HttpException('boom', 418), host);
    expect(status).toHaveBeenCalledWith(418);
    expect(json).toHaveBeenCalledWith({ statusCode: 418, message: 'boom' });
  });

  it('reshapes a raw Error into a structured 500 without leaking internals', () => {
    const filter = new GlobalHttpExceptionFilter();
    const { host, status, json } = mockHost();
    filter.catch(new Error('kaboom: secret stack details'), host);
    expect(status).toHaveBeenCalledWith(500);
    const body = json.mock.calls[0][0] as Record<string, unknown>;
    expect(body.statusCode).toBe(500);
    expect(body.message).toBe('Internal server error');
    expect(typeof body.timestamp).toBe('string');
    expect(Number.isNaN(Date.parse(body.timestamp as string))).toBe(false);
    expect(JSON.stringify(body)).not.toContain('kaboom');
    expect(body.requestId).toBeUndefined();
  });

  it('echoes x-request-id into the 500 body when present', () => {
    const filter = new GlobalHttpExceptionFilter();
    const { host, json } = mockHost({ headers: { 'x-request-id': 'req-123' } });
    filter.catch(new Error('down'), host);
    const body = json.mock.calls[0][0] as Record<string, unknown>;
    expect(body.requestId).toBe('req-123');
  });

  it('reshapes non-Error throwables into a structured 500', () => {
    const filter = new GlobalHttpExceptionFilter();
    const { host, status, json } = mockHost();
    filter.catch('string failure', host);
    expect(status).toHaveBeenCalledWith(500);
    expect((json.mock.calls[0][0] as Record<string, unknown>).statusCode).toBe(
      500,
    );
  });
});
