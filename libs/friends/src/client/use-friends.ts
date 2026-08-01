import { useMyId } from '@libs/auth/client/use-current-user';
import {
  FriendshipCol,
  FRIENDSHIPS_TABLE,
} from '@libs/db/shared/friends-tables';
import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import type { Sql } from '@pkgs/sql';
import { col, sqlMap } from '@pkgs/sql-map';

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

function friendIdExpr(myId: string) {
  return [
    'case',
    [
      [
        ['=', col(`f.${FriendshipCol.userLow}`), myId],
        col(`f.${FriendshipCol.userHigh}`),
      ],
    ],
    col(`f.${FriendshipCol.userLow}`),
  ] as const;
}

function friendsSql(myId: string): Sql {
  if (myId.length === 0) {
    return sqlMap({
      select: [
        [['param', ''], 'friend_id'],
        [['param', ''], 'username'],
        [['param', null], 'avatar_config'],
        [['param', ''], 'friends_since'],
      ],
      from: FRIENDSHIPS_TABLE.tableName,
      where: ['=', 1, 0],
    });
  }
  const friendId = friendIdExpr(myId);
  return sqlMap({
    select: [
      [friendId, 'friend_id'],
      [`p.${ProfileCol.username}`, 'username'],
      [`p.${ProfileCol.avatarConfig}`, 'avatar_config'],
      [`f.${FriendshipCol.createdAt}`, 'friends_since'],
    ],
    from: [FRIENDSHIPS_TABLE.tableName, 'f'],
    join: [
      [PROFILES_TABLE.tableName, 'p'],
      ['=', `p.${ProfileCol.id}`, friendId],
    ],
    where: [
      'or',
      ['=', `f.${FriendshipCol.userLow}`, myId],
      ['=', `f.${FriendshipCol.userHigh}`, myId],
    ],
    orderBy: [[`p.${ProfileCol.username}`, 'asc', { collate: 'NOCASE' }]],
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
