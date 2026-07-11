import type {
  WritePolicy,
  WritePolicyRegistry,
} from '@pkgs/sync-engine/server/upload-handler';
import { createWritePolicyRegistry } from '@pkgs/sync-engine/server/upload-handler';

import {
  FRIEND_PROFILE_CACHE_TABLE,
  FRIEND_REQUESTS_TABLE,
  FRIENDSHIPS_TABLE,
  USER_BLOCKS_TABLE,
} from '@libs/db/shared/friends-tables';

function deny(reason: string): {
  readonly allowed: false;
  readonly reason: string;
} {
  return { allowed: false, reason };
}

const serverOnlyWritePolicy: WritePolicy = () =>
  deny('friends tables are server-managed');

export const FRIENDS_WRITE_POLICIES: Readonly<Record<string, WritePolicy>> = {
  [FRIEND_REQUESTS_TABLE.tableName]: serverOnlyWritePolicy,
  [FRIENDSHIPS_TABLE.tableName]: serverOnlyWritePolicy,
  [USER_BLOCKS_TABLE.tableName]: serverOnlyWritePolicy,
  [FRIEND_PROFILE_CACHE_TABLE.tableName]: serverOnlyWritePolicy,
};

export function createFriendsWritePolicyRegistry(): WritePolicyRegistry {
  return createWritePolicyRegistry(FRIENDS_WRITE_POLICIES);
}
