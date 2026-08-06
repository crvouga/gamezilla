import type { ConfigService } from '@libs/auth/client/config-service-types';
import {
  SyncApiAuthError,
  type GetFreshAuthToken,
  type SyncClientAuth,
  type SyncHttpFetch,
} from '@pkgs/sync-engine/client/sync-http-client';

export type SyncApiFetch = SyncHttpFetch;

type PubSubTokenCreds = { username: string; password: string };

async function resolveSessionToken(args: {
  readonly auth: SyncClientAuth;
  readonly getFreshAuthToken?: GetFreshAuthToken | undefined;
}): Promise<string | null> {
  const existing = args.auth.getSessionToken();
  if (existing !== null && existing.length > 0) return existing;
  if (!args.getFreshAuthToken) return null;
  return args.getFreshAuthToken({ skipCache: true });
}

function authHeaders(
  deviceId: string,
  token: string | null
): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-anon-id': deviceId,
  };
  if (token !== null && token.length > 0) {
    headers['authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function parsePubSubTokenBody(body: unknown): PubSubTokenCreds {
  if (typeof body !== 'object' || body === null) {
    throw new Error('pubsub token response invalid');
  }
  const { username, password } = body as {
    username?: unknown;
    password?: unknown;
  };
  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    password.length === 0
  ) {
    throw new Error('pubsub token response invalid');
  }
  return { username, password };
}

export async function fetchPubSubToken(args: {
  readonly config: ConfigService;
  readonly fetchFn: SyncApiFetch;
  readonly auth: SyncClientAuth;
  readonly getFreshAuthToken?: GetFreshAuthToken | undefined;
}): Promise<PubSubTokenCreds> {
  const base = args.config.getApiUrl().replace(/\/$/, '');
  const token = await resolveSessionToken(args);
  const res = await args.fetchFn(`${base}/api/pubsub/token`, {
    method: 'POST',
    headers: authHeaders(args.auth.getDeviceId() ?? '', token),
    body: '{}',
  });
  if (res.status === 401) {
    throw new SyncApiAuthError('expired');
  }
  if (!res.ok) {
    throw new Error(`pubsub token HTTP ${String(res.status)}`);
  }
  return parsePubSubTokenBody(await res.json());
}
