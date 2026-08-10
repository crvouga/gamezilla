import {
  type ClientRequestAuth,
  clientAuthHeaders,
} from '@libs/auth/client/client-request-auth';
import type { ConfigService } from '@libs/auth/client/config-service-types';

import type { UserSearchResult } from '../shared/user-search-types';

export type UserSearchApiFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export type UserSearchClientDeps = {
  readonly config: ConfigService;
  readonly fetchFn: UserSearchApiFetch;
  readonly auth: ClientRequestAuth;
};

/**
 * Absolute REST exception: cross-user search is not in any one sync scope.
 * Server route remains `POST /friends/search`.
 */
export class UserSearchClient {
  constructor(private readonly deps: UserSearchClientDeps) {}

  async search(
    query: string,
    limit?: number
  ): Promise<readonly UserSearchResult[]> {
    const url = `${this.deps.config.getApiUrl()}/api/friends/search`;
    const res = await this.deps.fetchFn(url, {
      method: 'POST',
      headers: clientAuthHeaders(this.deps.auth),
      body: JSON.stringify({
        query,
        ...(limit !== undefined ? { limit } : {}),
      }),
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
}
