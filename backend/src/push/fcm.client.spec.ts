import { generateKeyPairSync } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { FcmClient } from './fcm.client.js';

function config(values: Record<string, string>): ConfigService {
  return {
    get: (key: string, fallback = '') => values[key] ?? fallback,
  } as unknown as ConfigService;
}

function credentials() {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return {
    FCM_PROJECT_ID: 'demo-project',
    FCM_CLIENT_EMAIL: 'firebase-adminsdk@demo-project.iam.gserviceaccount.com',
    FCM_PRIVATE_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  };
}

function response(
  status: number,
  body: unknown,
): {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
  json: () => Promise<unknown>;
} {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
    json: async () => JSON.parse(text),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('FcmClient', () => {
  it('is disabled when Firebase credentials are absent', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const client = new FcmClient(config({}));
    const result = await client.sendMulticast(['token-1'], {
      title: 'Halo',
      body: 'Pesan',
    });

    expect(client.isEnabled).toBe(false);
    expect(result).toEqual({
      sent: 0,
      failed: 0,
      skipped: true,
      invalidTokens: [],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends an HTTP v1 notification and caches the OAuth token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response(200, { access_token: 'ya29.test', expires_in: 3600 }),
      )
      .mockResolvedValueOnce(response(200, { name: 'projects/demo/messages/1' }))
      .mockResolvedValueOnce(response(200, { name: 'projects/demo/messages/2' }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new FcmClient(config(credentials()));
    const result = await client.sendMulticast(['token-1', 'token-2'], {
      title: 'Koreksi disetujui',
      body: 'Pengajuan Anda sudah diproses.',
      data: { type: 'correction', id: 'c1' },
    });

    expect(result).toEqual({
      sent: 2,
      failed: 0,
      skipped: false,
      invalidTokens: [],
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://oauth2.googleapis.com/token',
    );

    const messageCall = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(messageCall[0]).toBe(
      'https://fcm.googleapis.com/v1/projects/demo-project/messages:send',
    );
    expect((messageCall[1].headers as Record<string, string>).authorization).toBe(
      'Bearer ya29.test',
    );
    const body = JSON.parse(String(messageCall[1].body)) as {
      message: {
        token: string;
        notification: { title: string; body: string };
        data: Record<string, string>;
        android: { priority: string };
      };
    };
    expect(body.message.token).toBe('token-1');
    expect(body.message.notification).toEqual({
      title: 'Koreksi disetujui',
      body: 'Pengajuan Anda sudah diproses.',
    });
    expect(body.message.data).toEqual({ type: 'correction', id: 'c1' });
    expect(body.message.android.priority).toBe('HIGH');
  });

  it('reports unregistered tokens so the caller can prune them', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response(200, { access_token: 'ya29.test', expires_in: 3600 }),
      )
      .mockResolvedValueOnce(
        response(404, { error: { status: 'UNREGISTERED' } }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const client = new FcmClient(config(credentials()));
    const result = await client.sendMulticast(['stale-token'], {
      title: 'Halo',
      body: 'Pesan',
    });

    expect(result.sent).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.invalidTokens).toEqual(['stale-token']);
  });

  it('reads credentials from a base64 service-account JSON blob', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const blob = Buffer.from(
      JSON.stringify({
        project_id: 'sa-project',
        client_email: 'sa@sa-project.iam.gserviceaccount.com',
        private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      }),
    ).toString('base64');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response(200, { access_token: 'ya29.sa', expires_in: 3600 }),
      )
      .mockResolvedValueOnce(response(200, { name: 'projects/sa/messages/1' }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new FcmClient(config({ FCM_SERVICE_ACCOUNT_JSON: blob }));
    await client.sendMulticast(['token-1'], { title: 'Halo', body: 'Pesan' });

    expect(client.isEnabled).toBe(true);
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://fcm.googleapis.com/v1/projects/sa-project/messages:send',
    );
  });

  it('honours FCM_ENABLED=false even when credentials exist', async () => {
    const client = new FcmClient(
      config({ ...credentials(), FCM_ENABLED: 'false' }),
    );

    expect(client.isEnabled).toBe(false);
    await expect(
      client.sendMulticast(['token-1'], { title: 'Halo', body: 'Pesan' }),
    ).resolves.toEqual({
      sent: 0,
      failed: 0,
      skipped: true,
      invalidTokens: [],
    });
  });

  it('does not mark server errors as invalid tokens', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response(200, { access_token: 'ya29.test', expires_in: 3600 }),
      )
      .mockResolvedValueOnce(response(503, 'temporarily unavailable'));
    vi.stubGlobal('fetch', fetchMock);

    const client = new FcmClient(config(credentials()));
    const result = await client.sendMulticast(['token-1'], {
      title: 'Halo',
      body: 'Pesan',
    });

    expect(result.sent).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.invalidTokens).toEqual([]);
  });
});
