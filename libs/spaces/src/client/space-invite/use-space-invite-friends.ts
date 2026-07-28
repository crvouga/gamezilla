import { useMyId } from '@libs/auth/client/use-current-user';
import {
  FRIEND_PROFILE_CACHE_TABLE,
  FRIENDSHIPS_TABLE,
  FriendProfileCacheCol,
  FriendshipCol,
} from '@libs/db/shared/friends-tables';
import { sql, ident } from '@pkgs/sql';
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
  // honey: ORDER BY ... COLLATE NOCASE has no honey representation.
  const { rows, isLoading } = useWatchQuery<FriendRow>(
    myId.length === 0
      ? sql`SELECT '' AS friend_id, '' AS username
         FROM ${ident(FRIEND_PROFILE_CACHE_TABLE.tableName)} WHERE 0`
      : sql`SELECT c.${ident(FriendProfileCacheCol.friendId)} AS friend_id,
                c.${ident(FriendProfileCacheCol.username)} AS username
         FROM ${ident(FRIEND_PROFILE_CACHE_TABLE.tableName)} c
         INNER JOIN ${ident(FRIENDSHIPS_TABLE.tableName)} f
           ON (
             (f.${ident(FriendshipCol.userLow)} = ${myId} AND f.${ident(FriendshipCol.userHigh)} = c.${ident(FriendProfileCacheCol.friendId)})
             OR (f.${ident(FriendshipCol.userHigh)} = ${myId} AND f.${ident(FriendshipCol.userLow)} = c.${ident(FriendProfileCacheCol.friendId)})
           )
         WHERE c.${ident(FriendProfileCacheCol.ownerId)} = ${myId}
         ORDER BY c.${ident(FriendProfileCacheCol.username)} COLLATE NOCASE`
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
