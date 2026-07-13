import {
  searchUsers,
  type FriendsClientDeps,
} from '@libs/friends/client/search-users/search-users';
import type { UserSearchResult } from '@libs/friends/shared/friends-types';

export async function searchForUsers(
  deps: FriendsClientDeps,
  query: string,
  limit?: number
): Promise<readonly UserSearchResult[]> {
  return searchUsers(deps, query, limit);
}
