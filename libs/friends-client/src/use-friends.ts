import { useMyId } from '@libs/auth-client/use-current-user';
import type { Sql } from '@pkgs/sql-shared/sql';
import sql from '@pkgs/sql-shared/sql';

import { createQuery, useSyncEngine } from '@pkgs/sync-engine-client/sync-engine-context';
import { type Accessor, createMemo } from 'solid-js';

import type { Friend } from '@libs/friends-shared/friends-types';

type FriendRow = {
  readonly friend_id: string;
  readonly username: string;
  readonly avatar_config: string | null;
  readonly friends_since: string;
};

function friendsSql(myId: string, enabled: boolean): Sql<FriendRow> {
  if (!enabled) {
    return sql<FriendRow>`
      SELECT
        CAST(NULL AS TEXT) AS friend_id,
        CAST(NULL AS TEXT) AS username,
        CAST(NULL AS TEXT) AS avatar_config,
        CAST(NULL AS TEXT) AS friends_since
      WHERE false
    `;
  }
  return sql<FriendRow>`
    SELECT
      CASE WHEN f.user_low = ${myId} THEN f.user_high ELSE f.user_low END AS friend_id,
      p.username,
      p.avatar_config,
      f.created_at AS friends_since
    FROM friends_friendships AS f
    INNER JOIN profile AS p
      ON p.id = CASE WHEN f.user_low = ${myId} THEN f.user_high ELSE f.user_low END
    WHERE (f.user_low = ${myId} OR f.user_high = ${myId})
      AND f.deleted_at IS NULL
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
  readonly friends: Accessor<readonly Friend[]>;
  readonly isLoading: Accessor<boolean>;
} {
  const { paintReady } = useSyncEngine();
  const myId = useMyId();
  const enabled = createMemo(() => paintReady() && myId().length > 0);
  const { rows, isLoading } = createQuery(() => friendsSql(myId(), enabled()));
  const friends = createMemo(() => {
    if (!paintReady()) return [];
    return rows()
      .filter((row) => row.friend_id.length > 0)
      .map(mapFriendRow);
  });
  const loading = createMemo(() => {
    if (!paintReady()) return true;
    return myId().length === 0 ? false : isLoading();
  });
  return { friends, isLoading: loading };
}

export function useFriendIds(): Accessor<readonly string[]> {
  const { friends } = useFriends();
  return createMemo(() => friends().map((friend) => friend.userId));
}
