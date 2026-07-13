import type { ConfigService } from '@libs/auth/client/config-service-types';

import type { UserSearchResult } from '../../shared/friends-types';
import { friendsApiJson, type FriendsApiFetch } from '../friends-api';

export type FriendsClientDeps = {
  readonly config: ConfigService;
  readonly fetchFn: FriendsApiFetch;
};

/** Absolute REST exception: cross-user search is not in any one sync scope. */
export async function searchUsers(
  deps: FriendsClientDeps,
  query: string,
  limit?: number
): Promise<readonly UserSearchResult[]> {
  const body = await friendsApiJson<{ results: UserSearchResult[] }>({
    ...deps,
    path: '/friends/search',
    init: {
      method: 'POST',
      body: JSON.stringify({ query, limit }),
    },
  });
  return body.results;
}
