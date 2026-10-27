import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sign } from 'node:crypto';
import { readFileSync } from 'node:fs';

export type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

export type FcmSendResult = {
  sent: number;
  failed: number;
  skipped: boolean;
  invalidTokens: string[];
};

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FCM_SEND_URL = 'https://fcm.googleapis.com/v1/projects';
const DEFAULT_CHANNEL_ID = 'face_absen_notifications';
const REQUEST_TIMEOUT_MS = 10_000;

type ServiceAccountCredentials = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

@Injectable()
export class FcmClient {
  private readonly logger = new Logger(FcmClient.name);
  private readonly projectId: string;
  private readonly clientEmail: string;
  private readonly privateKey: string;
  private readonly enabled: boolean;
  private accessToken?: { value: string; expiresAt: number };

  constructor(@Optional() config?: ConfigService) {
    // A service-account JSON file (the one Firebase console downloads) takes
    // precedence over the three individual env vars so deployments can keep the
    // credentials in one file instead of splitting the PEM across variables.
    const account = FcmClient.readServiceAccount(config);
    this.projectId = (
      account?.project_id ??
      config?.get<string>('FCM_PROJECT_ID', '') ??
      ''
    ).trim();
    this.clientEmail = (
      account?.client_email ??
      config?.get<string>('FCM_CLIENT_EMAIL', '') ??
      ''
    ).trim();
    this.privateKey = (
      account?.private_key ??
      config?.get<string>('FCM_PRIVATE_KEY', '') ??
      ''
    ).replace(/\\n/g, '\n');
    const explicitlyDisabled =
      config?.get<string>('FCM_ENABLED', '')?.toLowerCase() === 'false';
    this.enabled =
      !explicitlyDisabled &&
      Boolean(this.projectId && this.clientEmail && this.privateKey);
    if (!this.enabled) {
      this.logger.log(
        'FCM disabled: set FCM_PROJECT_ID, FCM_CLIENT_EMAIL, and FCM_PRIVATE_KEY to enable push delivery.',
      );
    }
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  private static readServiceAccount(
    config?: ConfigService,
  ): ServiceAccountCredentials | null {
    const path = config
      ?.get<string>('FCM_SERVICE_ACCOUNT_PATH', '')
      ?.trim();
    const inline = config
      ?.get<string>('FCM_SERVICE_ACCOUNT_JSON', '')
      ?.trim();
    let raw = inline;
    if (path) {
      try {
        raw = readFileSync(path, 'utf8');
      } catch (error) {
        const logger = new Logger(FcmClient.name);
        logger.error(
          `FCM service account file could not be read (${path}): ${error instanceof Error ? error.message : String(error)}`,
        );
        return null;
      }
    }
    if (!raw) return null;

    // Accept the raw JSON, or a base64 blob for env-var-only deployments.
    const text = raw.trimStart().startsWith('{')
      ? raw
      : Buffer.from(raw, 'base64').toString('utf8');
    try {
      const parsed = JSON.parse(text) as ServiceAccountCredentials;
      if (
        !parsed.project_id?.trim() ||
        !parsed.client_email?.trim() ||
        !parsed.private_key?.trim()
      ) {
        new Logger(FcmClient.name).warn(
          'FCM service account is missing project_id, client_email, or private_key; falling back to FCM_* variables.',
        );
        return null;
      }
      return parsed;
    } catch {
      new Logger(FcmClient.name).error(
        'FCM service account is not valid JSON; falling back to FCM_* variables.',
      );
      return null;
    }
  }

  async sendMulticast(
    tokens: string[],
    payload: PushPayload,
  ): Promise<FcmSendResult> {
    if (!this.enabled) {
      return { sent: 0, failed: 0, skipped: true, invalidTokens: [] };
    }
    if (tokens.length === 0) {
      return { sent: 0, failed: 0, skipped: true, invalidTokens: [] };
    }

    let accessToken: string;
    try {
      accessToken = await this.getAccessToken();
    } catch (error) {
      this.logger.warn(
        `FCM OAuth token request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        sent: 0,
        failed: tokens.length,
        skipped: false,
        invalidTokens: [],
      };
    }

    const url = `${FCM_SEND_URL}/${encodeURIComponent(this.projectId)}/messages:send`;
    let sent = 0;
    let failed = 0;
    const invalidTokens: string[] = [];

    for (const token of tokens) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          headers: {
            authorization: `Bearer ${accessToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token,
              notification: {
                title: payload.title,
                body: payload.body,
              },
              ...(payload.data ? { data: payload.data } : {}),
              android: {
                priority: 'HIGH',
                notification: {
                  channelId: DEFAULT_CHANNEL_ID,
                  sound: 'default',
                },
              },
            },
          }),
        });

        if (res.ok) {
          sent += 1;
          continue;
        }

        failed += 1;
        const text = await res.text().catch(() => '');
        if (
          res.status === 404 ||
          /UNREGISTERED|registration token/i.test(text)
        ) {
          invalidTokens.push(token);
        } else {
          this.logger.warn(
            `FCM send failed (${res.status}): ${text.slice(0, 300)}`,
          );
        }
      } catch (error) {
        failed += 1;
        this.logger.warn(
          `FCM send failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return { sent, failed, skipped: false, invalidTokens };
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.accessToken && this.accessToken.expiresAt > now + 60_000) {
      return this.accessToken.value;
    }

    const issuedAt = Math.floor(now / 1000);
    const header = base64Url(
      JSON.stringify({ alg: 'RS256', typ: 'JWT' }),
    );
    const claims = base64Url(
      JSON.stringify({
        iss: this.clientEmail,
        scope: FCM_SCOPE,
        aud: GOOGLE_TOKEN_URL,
        iat: issuedAt,
        exp: issuedAt + 3600,
      }),
    );
    const unsigned = `${header}.${claims}`;
    const assertion = `${unsigned}.${sign(
      'sha256',
      Buffer.from(unsigned),
      this.privateKey,
    ).toString('base64url')}`;

    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }).toString(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`OAuth ${res.status}: ${text.slice(0, 300)}`);
    }
    const body = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!body.access_token) {
      throw new Error('OAuth response did not include access_token');
    }
    const ttl = Number(body.expires_in ?? 3600);
    this.accessToken = {
      value: body.access_token,
      expiresAt: now + (Number.isFinite(ttl) && ttl > 0 ? ttl : 3600) * 1000,
    };
    return body.access_token;
  }
}
