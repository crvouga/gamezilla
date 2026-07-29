import { getCachedDeviceId } from '@libs/auth/client/use-device-id';
import { getCachedAuthToken } from '@libs/auth/client/use-fresh-auth-token';
import type { ConfigService } from '@libs/auth/client/config-service-types';

import type { UserSearchResult } from '../shared/user-search-types';

const X_ANON_ID = 'x-anon-id';

export type UserSearchApiFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export type UserSearchClientDeps = {
  readonly config: ConfigService;
  readonly fetchFn: UserSearchApiFetch;
};

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

/**
 * Absolute REST exception: cross-user search is not in any one sync scope.
 * Server route remains `POST /friends/search`.
 */
export async function searchUsers(
  deps: UserSearchClientDeps,
  query: string,
  limit?: number
): Promise<readonly UserSearchResult[]> {
  const url = `${deps.config.getApiUrl()}/api/friends/search`;
  const res = await deps.fetchFn(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ query, limit }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `user search failed (${res.status})${body.length > 0 ? `: ${body}` : ''}`
    );
  }
  const json = (await res.json()) as { results: UserSearchResult[] };
  return json.results;
}
