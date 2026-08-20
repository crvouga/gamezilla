import type { UserSearchResult } from '@libs/user-search/public/user-search-types';
import type { Clock } from '@pkgs/clock';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { FriendSearchService } from './friend-search-service';

export class SearchFriendsUseCase {
  constructor(
    private readonly db: SqlClient,
    private readonly clock: Clock
  ) {}

  async execute(args: {
    readonly viewerId: string;
    readonly rawQuery: string;
    readonly limit?: number;
  }): Promise<readonly UserSearchResult[]> {
    return new FriendSearchService(this.db, this.clock).searchUsers(args);
  }
}
