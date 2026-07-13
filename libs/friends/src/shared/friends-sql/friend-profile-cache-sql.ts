import {
  FRIEND_PROFILE_CACHE_TABLE,
  FriendProfileCacheCol,
} from '@libs/db/shared/friends-tables';
import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { pairId } from '../pair-id';

type ProfileCardLite = {
  readonly username: string;
  readonly avatarConfig: string | null;
};

async function readProfileCard(
  sql: SqlClient,
  profileId: string
): Promise<ProfileCardLite | null> {
  const rows = await sql.query<Record<string, unknown>>(
    `SELECT ${ProfileCol.username}, ${ProfileCol.avatarConfig}
     FROM ${PROFILES_TABLE.tableName}
     WHERE ${ProfileCol.id} = ?
     LIMIT 1`,
    [profileId]
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
  sql: SqlClient,
  args: {
    readonly ownerId: string;
    readonly friendId: string;
    readonly username: string;
    readonly avatarConfig: string | null;
    readonly now: string;
  }
): Promise<void> {
  await sql.run(
    `INSERT INTO ${FRIEND_PROFILE_CACHE_TABLE.tableName}
     (${FriendProfileCacheCol.id}, ${FriendProfileCacheCol.ownerId}, ${FriendProfileCacheCol.friendId},
      ${FriendProfileCacheCol.username},
      ${FriendProfileCacheCol.avatarConfig}, ${FriendProfileCacheCol.updatedAt})
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (${FriendProfileCacheCol.ownerId}, ${FriendProfileCacheCol.friendId}) DO UPDATE SET
       ${FriendProfileCacheCol.username} = excluded.${FriendProfileCacheCol.username},
       ${FriendProfileCacheCol.avatarConfig} = excluded.${FriendProfileCacheCol.avatarConfig},
       ${FriendProfileCacheCol.updatedAt} = excluded.${FriendProfileCacheCol.updatedAt}`,
    [
      pairId(args.ownerId, args.friendId),
      args.ownerId,
      args.friendId,
      args.username,
      args.avatarConfig,
      args.now,
    ]
  );
}

export async function clearFriendProfileCaches(
  sql: SqlClient,
  userA: string,
  userB: string
): Promise<void> {
  await sql.run(
    `DELETE FROM ${FRIEND_PROFILE_CACHE_TABLE.tableName}
     WHERE (${FriendProfileCacheCol.ownerId} = ? AND ${FriendProfileCacheCol.friendId} = ?)
        OR (${FriendProfileCacheCol.ownerId} = ? AND ${FriendProfileCacheCol.friendId} = ?)`,
    [userA, userB, userB, userA]
  );
}

/**
 * Upsert only `owner_id = actorId` so PowerSync upload authorize
 * (`owner_id === myId`) accepts the row.
 */
export async function syncActorFriendProfileCache(
  sql: SqlClient,
  args: {
    readonly actorId: string;
    readonly otherUserId: string;
    readonly now: string;
    readonly friendProfile?: ProfileCardLite;
  }
): Promise<void> {
  const other =
    args.friendProfile ?? (await readProfileCard(sql, args.otherUserId));
  if (other === null) return;
  await upsertFriendProfileCache(sql, {
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
  sql: SqlClient,
  actorId: string,
  peerUserId: string,
  now: string
): Promise<void> {
  const mine = await readProfileCard(sql, actorId);
  if (mine === null) return;
  await upsertFriendProfileCache(sql, {
    ownerId: peerUserId,
    friendId: actorId,
    username: mine.username,
    avatarConfig: mine.avatarConfig,
    now,
  });
}
