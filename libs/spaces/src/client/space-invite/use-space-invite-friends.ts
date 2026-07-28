import { useMyId } from '@libs/auth/client/use-current-user';
import {
  FRIEND_PROFILE_CACHE_TABLE,
  FRIENDSHIPS_TABLE,
  FriendProfileCacheCol,
  FriendshipCol,
} from '@libs/db/shared/friends-tables';
import { honey, col } from '@pkgs/sql';
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
  const friendIdCol = col(`c.${FriendProfileCacheCol.friendId}`);
  const { rows, isLoading } = useWatchQuery<FriendRow>(
    myId.length === 0
      ? honey({
          select: [
            [['param', ''], 'friend_id'],
            [['param', ''], 'username'],
          ],
          from: FRIEND_PROFILE_CACHE_TABLE.tableName,
          where: ['=', 1, 0],
        })
      : honey({
          select: [
            [`c.${FriendProfileCacheCol.friendId}`, 'friend_id'],
            [`c.${FriendProfileCacheCol.username}`, 'username'],
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
            [
              `c.${FriendProfileCacheCol.username}`,
              'asc',
              { collate: 'NOCASE' },
            ],
          ],
        })
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
