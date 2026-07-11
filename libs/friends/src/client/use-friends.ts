import { useMyId } from '@libs/auth/client/use-current-user';
import {
  FRIEND_PROFILE_CACHE_TABLE,
  FRIENDSHIPS_TABLE,
  FriendProfileCacheCol,
  FriendshipCol,
} from '@libs/db/shared/friends-tables';
import { useMemo } from 'react';
import { useWatchQuery } from '@pkgs/sync-engine/client/sync-engine-context';

import { otherUserInPair } from '../shared/canonical-pair';
import type { Friend } from '../shared/friends-types';

type FriendRow = {
  readonly friend_id: string;
  readonly display_name: string;
  readonly username: string;
  readonly avatar_config: string | null;
  readonly friends_since: string;
};

function friendsSql(myId: string): { sql: string; params: string[] } {
  if (myId.length === 0) {
    return {
      sql: `SELECT '' AS friend_id, '' AS display_name, '' AS username,
                   NULL AS avatar_config, '' AS friends_since
            FROM ${FRIEND_PROFILE_CACHE_TABLE.tableName} WHERE 0`,
      params: [],
    };
  }
  return {
    sql: `SELECT c.${FriendProfileCacheCol.friendId} AS friend_id,
                 c.${FriendProfileCacheCol.displayName} AS display_name,
                 c.${FriendProfileCacheCol.username} AS username,
                 c.${FriendProfileCacheCol.avatarConfig} AS avatar_config,
                 f.${FriendshipCol.createdAt} AS friends_since
          FROM ${FRIEND_PROFILE_CACHE_TABLE.tableName} c
          INNER JOIN ${FRIENDSHIPS_TABLE.tableName} f
            ON (
              (f.${FriendshipCol.userLow} = ? AND f.${FriendshipCol.userHigh} = c.${FriendProfileCacheCol.friendId})
              OR (f.${FriendshipCol.userHigh} = ? AND f.${FriendshipCol.userLow} = c.${FriendProfileCacheCol.friendId})
            )
          WHERE c.${FriendProfileCacheCol.ownerId} = ?
          ORDER BY c.${FriendProfileCacheCol.displayName} COLLATE NOCASE`,
    params: [myId, myId, myId],
  };
}

function mapFriendRow(row: FriendRow): Friend {
  return {
    userId: row.friend_id,
    displayName: row.display_name,
    username: row.username,
    avatarConfig: row.avatar_config,
    friendsSince: row.friends_since,
  };
}

export function useFriends(): {
  friends: readonly Friend[];
  isLoading: boolean;
} {
  const myId = useMyId();
  const query = useMemo(() => friendsSql(myId), [myId]);
  const { rows, isLoading } = useWatchQuery<FriendRow>(query.sql, query.params);
  const friends = useMemo(
    () => rows.filter((row) => row.friend_id.length > 0).map(mapFriendRow),
    [rows]
  );
  return { friends, isLoading: myId.length === 0 ? false : isLoading };
}

export function useFriendIds(): readonly string[] {
  const { friends } = useFriends();
  return useMemo(() => friends.map((friend) => friend.userId), [friends]);
}

export { otherUserInPair };
