import { getCachedDeviceId } from '@libs/auth/client/use-device-id';
import { getCachedAuthToken } from '@libs/auth/client/use-fresh-auth-token';
import type { ConfigService } from '@libs/auth/client/config-service-types';

const X_ANON_ID = 'x-anon-id';

export type FriendsApiFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

function authHeaders(): Record<string, string> {
  const token = getCachedAuthToken();
  const anon = getCachedDeviceId();
  if (token !== null && token.length > 0) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    if (anon !== null && anon.length > 0) {
      headers[X_ANON_ID] = anon;
    }
    return headers;
  }
  if (anon !== null && anon.length > 0) {
    return { [X_ANON_ID]: anon, 'Content-Type': 'application/json' };
  }
  return { 'Content-Type': 'application/json' };
}

export async function friendsApiFetch(args: {
  readonly config: ConfigService;
  readonly fetchFn: FriendsApiFetch;
  readonly path: string;
  readonly init?: RequestInit;
}): Promise<Response> {
  const url = `${args.config.getApiUrl()}/api${args.path}`;
  return args.fetchFn(url, {
    ...args.init,
    headers: {
      ...authHeaders(),
      ...args.init?.headers,
    },
  });
}

export async function friendsApiJson<T>(args: {
  readonly config: ConfigService;
  readonly fetchFn: FriendsApiFetch;
  readonly path: string;
  readonly init?: RequestInit;
}): Promise<T> {
  const res = await friendsApiFetch(args);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `friends api failed (${res.status})${body.length > 0 ? `: ${body}` : ''}`
    );
  }
  return (await res.json()) as T;
}
