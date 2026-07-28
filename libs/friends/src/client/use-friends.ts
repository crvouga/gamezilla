import { useMyId } from '@libs/auth/client/use-current-user';
import {
  FRIEND_PROFILE_CACHE_TABLE,
  FRIENDSHIPS_TABLE,
  FriendProfileCacheCol,
  FriendshipCol,
} from '@libs/db/shared/friends-tables';
import { raw, sql, type Sql } from '@pkgs/sql';
import { useMemo } from 'react';
import { useWatchQuery } from '@pkgs/sync-engine/client/sync-engine-context';

import { otherUserInPair } from '../shared/canonical-pair';
import type { Friend } from '../shared/friends-types';

type FriendRow = {
  readonly friend_id: string;
  readonly username: string;
  readonly avatar_config: string | null;
  readonly friends_since: string;
};

function friendsSql(myId: string): Sql {
  if (myId.length === 0) {
    return sql`
      SELECT '' AS friend_id, '' AS username,
             NULL AS avatar_config, '' AS friends_since
      FROM ${raw(FRIEND_PROFILE_CACHE_TABLE.tableName)} WHERE 0
    `;
  }
  return sql`
    SELECT c.${raw(FriendProfileCacheCol.friendId)} AS friend_id,
           c.${raw(FriendProfileCacheCol.username)} AS username,
           c.${raw(FriendProfileCacheCol.avatarConfig)} AS avatar_config,
           f.${raw(FriendshipCol.createdAt)} AS friends_since
    FROM ${raw(FRIEND_PROFILE_CACHE_TABLE.tableName)} c
    INNER JOIN ${raw(FRIENDSHIPS_TABLE.tableName)} f
      ON (
        (f.${raw(FriendshipCol.userLow)} = ${myId} AND f.${raw(FriendshipCol.userHigh)} = c.${raw(FriendProfileCacheCol.friendId)})
        OR (f.${raw(FriendshipCol.userHigh)} = ${myId} AND f.${raw(FriendshipCol.userLow)} = c.${raw(FriendProfileCacheCol.friendId)})
      )
    WHERE c.${raw(FriendProfileCacheCol.ownerId)} = ${myId}
    ORDER BY c.${raw(FriendProfileCacheCol.username)} COLLATE NOCASE
  `;
}

function mapFriendRow(row: FriendRow): Friend {
  return {
    userId: row.friend_id,
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
  const { rows, isLoading } = useWatchQuery<FriendRow>(query);
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
