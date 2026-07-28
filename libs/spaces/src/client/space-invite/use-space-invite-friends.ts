import { useMyId } from '@libs/auth/client/use-current-user';
import {
  FRIEND_PROFILE_CACHE_TABLE,
  FRIENDSHIPS_TABLE,
  FriendProfileCacheCol,
  FriendshipCol,
} from '@libs/db/shared/friends-tables';
import { raw, sql } from '@pkgs/sql';
import { useWatchQuery } from '@pkgs/sync-engine/client/sync-engine-context';
import { useMemo } from 'react';

type FriendRow = {
  readonly friend_id: string;
  readonly username: string;
};

/** Friends available to invite into a space (local sync read). */
export function useSpaceInviteFriends(): {
  readonly friends: readonly {
    readonly userId: string;
    readonly username: string;
  }[];
  readonly isLoading: boolean;
} {
  const myId = useMyId();
  const { rows, isLoading } = useWatchQuery<FriendRow>(
    myId.length === 0
      ? sql`SELECT '' AS friend_id, '' AS username
         FROM ${raw(FRIEND_PROFILE_CACHE_TABLE.tableName)} WHERE 0`
      : sql`SELECT c.${raw(FriendProfileCacheCol.friendId)} AS friend_id,
                c.${raw(FriendProfileCacheCol.username)} AS username
         FROM ${raw(FRIEND_PROFILE_CACHE_TABLE.tableName)} c
         INNER JOIN ${raw(FRIENDSHIPS_TABLE.tableName)} f
           ON (
             (f.${raw(FriendshipCol.userLow)} = ${myId} AND f.${raw(FriendshipCol.userHigh)} = c.${raw(FriendProfileCacheCol.friendId)})
             OR (f.${raw(FriendshipCol.userHigh)} = ${myId} AND f.${raw(FriendshipCol.userLow)} = c.${raw(FriendProfileCacheCol.friendId)})
           )
         WHERE c.${raw(FriendProfileCacheCol.ownerId)} = ${myId}
         ORDER BY c.${raw(FriendProfileCacheCol.username)} COLLATE NOCASE`
  );
  const friends = useMemo(
    () =>
      rows
        .filter((row) => row.friend_id.length > 0)
        .map((row) => ({ userId: row.friend_id, username: row.username })),
    [rows]
  );
  return { friends, isLoading: myId.length === 0 ? false : isLoading };
}
