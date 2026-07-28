import { useMyId } from '@libs/auth/client/use-current-user';
import {
  FRIEND_PROFILE_CACHE_TABLE,
  FRIENDSHIPS_TABLE,
  FriendProfileCacheCol,
  FriendshipCol,
} from '@libs/db/shared/friends-tables';
import { honey, col, type Sql } from '@pkgs/sql';
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
    return honey({
      select: [
        [['param', ''], 'friend_id'],
        [['param', ''], 'username'],
        [['param', null], 'avatar_config'],
        [['param', ''], 'friends_since'],
      ],
      from: FRIEND_PROFILE_CACHE_TABLE.tableName,
      where: ['=', 1, 0],
    });
  }
  const friendIdCol = col(`c.${FriendProfileCacheCol.friendId}`);
  return honey({
    select: [
      [`c.${FriendProfileCacheCol.friendId}`, 'friend_id'],
      [`c.${FriendProfileCacheCol.username}`, 'username'],
      [`c.${FriendProfileCacheCol.avatarConfig}`, 'avatar_config'],
      [`f.${FriendshipCol.createdAt}`, 'friends_since'],
    ],
    from: [FRIEND_PROFILE_CACHE_TABLE.tableName, 'c'],
    join: [
      [FRIENDSHIPS_TABLE.tableName, 'f'],
      [
        'or',
        [
          'and',
          ['=', `f.${FriendshipCol.userLow}`, myId],
          ['=', `f.${FriendshipCol.userHigh}`, friendIdCol],
        ],
        [
          'and',
          ['=', `f.${FriendshipCol.userHigh}`, myId],
          ['=', `f.${FriendshipCol.userLow}`, friendIdCol],
        ],
      ],
    ],
    where: ['=', `c.${FriendProfileCacheCol.ownerId}`, myId],
    orderBy: [
      [`c.${FriendProfileCacheCol.username}`, 'asc', { collate: 'NOCASE' }],
    ],
  });
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
