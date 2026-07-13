import type { SqlClient } from '@pkgs/sql-client/interface';

import { searchUsers } from './search-service';

export const FriendService = {
  searchUsers,
};

export type { SqlClient };
