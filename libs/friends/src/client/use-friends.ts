import { useMyId } from '@libs/auth/client/use-current-user';
import {
  FRIEND_PROFILE_CACHE_TABLE,
  FRIENDSHIPS_TABLE,
  FriendProfileCacheCol,
  FriendshipCol,
} from '@libs/db/shared/friends-tables';
import { sql, type Sql, ident } from '@pkgs/sql';
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

// honey: literal-string SELECT columns and ORDER BY ... COLLATE NOCASE have no honey representation.
function friendsSql(myId: string): Sql {
  if (myId.length === 0) {
    return sql`
      SELECT '' AS friend_id, '' AS username,
             NULL AS avatar_config, '' AS friends_since
      FROM ${ident(FRIEND_PROFILE_CACHE_TABLE.tableName)} WHERE 0
    `;
  }
  return sql`
    SELECT c.${ident(FriendProfileCacheCol.friendId)} AS friend_id,
           c.${ident(FriendProfileCacheCol.username)} AS username,
           c.${ident(FriendProfileCacheCol.avatarConfig)} AS avatar_config,
           f.${ident(FriendshipCol.createdAt)} AS friends_since
    FROM ${ident(FRIEND_PROFILE_CACHE_TABLE.tableName)} c
    INNER JOIN ${ident(FRIENDSHIPS_TABLE.tableName)} f
      ON (
        (f.${ident(FriendshipCol.userLow)} = ${myId} AND f.${ident(FriendshipCol.userHigh)} = c.${ident(FriendProfileCacheCol.friendId)})
        OR (f.${ident(FriendshipCol.userHigh)} = ${myId} AND f.${ident(FriendshipCol.userLow)} = c.${ident(FriendProfileCacheCol.friendId)})
      )
    WHERE c.${ident(FriendProfileCacheCol.ownerId)} = ${myId}
    ORDER BY c.${ident(FriendProfileCacheCol.username)} COLLATE NOCASE
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
