import type { ConfigService } from '@libs/auth-shared/config-service-types';
import type {
  GetFreshAuthToken,
  SyncClientAuth,
  SyncHttpFetch,
} from '@pkgs/sync-engine-client/sync-http-client';
import { SyncApiAuthError } from '@pkgs/sync-engine-client/sync-http-client';

export type SyncApiFetch = SyncHttpFetch;

type PubSubTokenCreds = {
  username: string;
  password: string;
  /** The topics the token grants; absent from an older server. */
  topics?: readonly string[] | undefined;
};

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
  const { username, password, topics } = body as {
    username?: unknown;
    password?: unknown;
    topics?: unknown;
  };
  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    password.length === 0
  ) {
    throw new Error('pubsub token response invalid');
  }
  const granted =
    Array.isArray(topics) &&
    topics.every((topic): topic is string => typeof topic === 'string')
      ? topics
      : undefined;
  return { username, password, topics: granted };
}

export async function fetchPubSubToken(args: {
  readonly config: ConfigService;
  readonly fetchFn: SyncApiFetch;
  readonly auth: SyncClientAuth;
  readonly getFreshAuthToken?: GetFreshAuthToken | undefined;
}): Promise<PubSubTokenCreds> {
  const base = args.config.getApiUrl().replace(/\/$/, '');
  const deviceId = args.auth.getDeviceId() ?? '';
  const url = `${base}/api/pubsub/token`;
  const post = (bearer: string | null) =>
    args.fetchFn(url, {
      method: 'POST',
      headers: authHeaders(deviceId, bearer),
      body: '{}',
    });
  let token = await resolveSessionToken(args);
  let res = await post(token);
  if (res.status === 401 && args.getFreshAuthToken !== undefined) {
    token = await args.getFreshAuthToken({ skipCache: true });
    res = await post(token);
  }
  if (res.status === 401) {
    throw new SyncApiAuthError('expired');
  }
  if (!res.ok) {
    throw new Error(`pubsub token HTTP ${String(res.status)}`);
  }
  const body = await res.json();
  return parsePubSubTokenBody(body);
}
