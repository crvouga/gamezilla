import { useMyId } from '@libs/auth/client/use-current-user';
import type { Sql } from '@pkgs/sql';
import { sql } from '@pkgs/sql';

import { useWatchQuery } from '@pkgs/sync-engine/client/sync-engine-context';
import { useMemo } from 'react';

import { otherUserInPair } from '../shared/canonical-pair';
import type { Friend } from '../shared/friends-types';

type FriendRow = {
  readonly friend_id: string;
  readonly username: string;
  readonly avatar_config: string | null;
  readonly friends_since: string;
};

function friendsSql(myId: string): Sql<FriendRow> {
  return sql<FriendRow>`
    SELECT
      CASE WHEN f.user_low = ${myId} THEN f.user_high ELSE f.user_low END AS friend_id,
      p.username,
      p.avatar_config,
      f.created_at AS friends_since
    FROM friendships AS f
    INNER JOIN profiles AS p
      ON p.id = CASE WHEN f.user_low = ${myId} THEN f.user_high ELSE f.user_low END
    WHERE f.user_low = ${myId} OR f.user_high = ${myId}
    ORDER BY p.username COLLATE NOCASE ASC
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
  const { rows, isLoading } = useWatchQuery(query);
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
