import {
  FRIEND_PROFILE_CACHE_TABLE,
  FriendProfileCacheCol,
} from '@libs/db/shared/friends-tables';
import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import { honey, col } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { pairId } from '../pair-id';

type ProfileCardLite = {
  readonly username: string;
  readonly avatarConfig: string | null;
};

async function readProfileCard(
  db: SqlClient,
  profileId: string
): Promise<ProfileCardLite | null> {
  const rows = await db.query<Record<string, unknown>>(
    honey({
      select: [ProfileCol.username, ProfileCol.avatarConfig],
      from: PROFILES_TABLE.tableName,
      where: ['=', ProfileCol.id, profileId],
      limit: 1,
    })
  );
  const row = rows[0];
  if (row === undefined) return null;
  const username = row[ProfileCol.username];
  const avatarRaw = row[ProfileCol.avatarConfig];
  return {
    username: typeof username === 'string' ? username : '',
    avatarConfig: typeof avatarRaw === 'string' ? avatarRaw : null,
  };
}

export async function upsertFriendProfileCache(
  db: SqlClient,
  args: {
    readonly ownerId: string;
    readonly friendId: string;
    readonly username: string;
    readonly avatarConfig: string | null;
    readonly now: string;
  }
): Promise<void> {
  await db.run(
    honey({
      insertInto: FRIEND_PROFILE_CACHE_TABLE.tableName,
      values: {
        [FriendProfileCacheCol.id]: pairId(args.ownerId, args.friendId),
        [FriendProfileCacheCol.ownerId]: args.ownerId,
        [FriendProfileCacheCol.friendId]: args.friendId,
        [FriendProfileCacheCol.username]: args.username,
        [FriendProfileCacheCol.avatarConfig]: args.avatarConfig,
        [FriendProfileCacheCol.updatedAt]: args.now,
      },
      onConflict: {
        target: [FriendProfileCacheCol.ownerId, FriendProfileCacheCol.friendId],
        set: {
          [FriendProfileCacheCol.username]: col(
            `excluded.${FriendProfileCacheCol.username}`
          ),
          [FriendProfileCacheCol.avatarConfig]: col(
            `excluded.${FriendProfileCacheCol.avatarConfig}`
          ),
          [FriendProfileCacheCol.updatedAt]: col(
            `excluded.${FriendProfileCacheCol.updatedAt}`
          ),
        },
      },
    })
  );
}

export async function clearFriendProfileCaches(
  db: SqlClient,
  userA: string,
  userB: string
): Promise<void> {
  await db.run(
    honey({
      deleteFrom: FRIEND_PROFILE_CACHE_TABLE.tableName,
      where: [
        'or',
        [
          'and',
          ['=', FriendProfileCacheCol.ownerId, userA],
          ['=', FriendProfileCacheCol.friendId, userB],
        ],
        [
          'and',
          ['=', FriendProfileCacheCol.ownerId, userB],
          ['=', FriendProfileCacheCol.friendId, userA],
        ],
      ],
    })
  );
}

/**
 * Upsert only `owner_id = actorId` so PowerSync upload authorize
 * (`owner_id === myId`) accepts the row.
 */
export async function syncActorFriendProfileCache(
  db: SqlClient,
  args: {
    readonly actorId: string;
    readonly otherUserId: string;
    readonly now: string;
    readonly friendProfile?: ProfileCardLite;
  }
): Promise<void> {
  const other =
    args.friendProfile ?? (await readProfileCard(db, args.otherUserId));
  if (other === null) return;
  await upsertFriendProfileCache(db, {
    ownerId: args.actorId,
    friendId: args.otherUserId,
    username: other.username,
    avatarConfig: other.avatarConfig,
    now: args.now,
  });
}

/**
 * Server-only follow-up: write the peer's cache of the actor after accept.
 * Safe on Postgres SqlClient; do not call from client execute.
 */
export async function syncPeerFriendProfileCache(
  db: SqlClient,
  actorId: string,
  peerUserId: string,
  now: string
): Promise<void> {
  const mine = await readProfileCard(db, actorId);
  if (mine === null) return;
  await upsertFriendProfileCache(db, {
    ownerId: peerUserId,
    friendId: actorId,
    username: mine.username,
    avatarConfig: mine.avatarConfig,
    now,
  });
}
