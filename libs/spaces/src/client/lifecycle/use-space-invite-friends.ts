import { useMyId } from '@libs/auth/client/use-current-user';
import {
  FRIEND_PROFILE_CACHE_TABLE,
  FRIENDSHIPS_TABLE,
  FriendProfileCacheCol,
  FriendshipCol,
} from '@libs/db/shared/friends-tables';
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
      ? `SELECT '' AS friend_id, '' AS username
         FROM ${FRIEND_PROFILE_CACHE_TABLE.tableName} WHERE 0`
      : `SELECT c.${FriendProfileCacheCol.friendId} AS friend_id,
                c.${FriendProfileCacheCol.username} AS username
         FROM ${FRIEND_PROFILE_CACHE_TABLE.tableName} c
         INNER JOIN ${FRIENDSHIPS_TABLE.tableName} f
           ON (
             (f.${FriendshipCol.userLow} = ? AND f.${FriendshipCol.userHigh} = c.${FriendProfileCacheCol.friendId})
             OR (f.${FriendshipCol.userHigh} = ? AND f.${FriendshipCol.userLow} = c.${FriendProfileCacheCol.friendId})
           )
         WHERE c.${FriendProfileCacheCol.ownerId} = ?
         ORDER BY c.${FriendProfileCacheCol.username} COLLATE NOCASE`,
    myId.length === 0 ? [] : [myId, myId, myId]
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
