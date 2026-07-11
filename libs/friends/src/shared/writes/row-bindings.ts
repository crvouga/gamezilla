import {
  FRIEND_PROFILE_CACHE_TABLE,
  FRIEND_REQUESTS_TABLE,
  FRIENDSHIPS_TABLE,
  USER_BLOCKS_TABLE,
} from '@libs/db/shared/friends-tables';
import { denyAllRowBinding, type RowWriteBinding } from '@pkgs/write/server/row-write-registry';
import type { RowChange } from '@pkgs/write/shared/row-change';

export const FRIENDS_ROW_BINDINGS: Readonly<Record<string, RowWriteBinding<RowChange>>> =
  {
    [FRIEND_REQUESTS_TABLE.tableName]: denyAllRowBinding('FRIENDS_SERVER_MANAGED'),
    [FRIENDSHIPS_TABLE.tableName]: denyAllRowBinding('FRIENDS_SERVER_MANAGED'),
    [USER_BLOCKS_TABLE.tableName]: denyAllRowBinding('FRIENDS_SERVER_MANAGED'),
    [FRIEND_PROFILE_CACHE_TABLE.tableName]: denyAllRowBinding('FRIENDS_SERVER_MANAGED'),
  };
