import {
  type ClientRequestAuth,
  clientAuthHeaders,
} from '@libs/auth/client/client-request-auth';
import type { ConfigService } from '@libs/auth/client/config-service-types';

export type FriendsApiFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export async function friendsApiFetch(args: {
  readonly config: ConfigService;
  readonly fetchFn: FriendsApiFetch;
  readonly auth: ClientRequestAuth;
  readonly path: string;
  readonly init?: RequestInit;
}): Promise<Response> {
  const url = `${args.config.getApiUrl()}/api${args.path}`;
  return args.fetchFn(url, {
    ...args.init,
    headers: {
      ...clientAuthHeaders(args.auth),
      ...args.init?.headers,
    },
  });
}

export async function friendsApiJson<T>(args: {
  readonly config: ConfigService;
  readonly fetchFn: FriendsApiFetch;
  readonly auth: ClientRequestAuth;
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
