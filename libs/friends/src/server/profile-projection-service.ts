import {
  readProfileCardById,
  readProfileCardsByIds,
  type ProfileCard,
} from '@libs/profile/server/read-profile';
import type { SqlClient } from '@pkgs/sql-client/interface';

import {
  deleteFriendProfileCachePair,
  upsertFriendProfileCache,
} from './friend-repository';

function profileCardToCache(card: ProfileCard): {
  readonly displayName: string;
  readonly username: string;
  readonly avatarConfig: string | null;
} {
  return {
    displayName: card.displayName,
    username: card.username,
    avatarConfig: card.avatarConfig,
  };
}

export async function syncFriendProfileCaches(
  sql: SqlClient,
  userA: string,
  userB: string,
  now: string
): Promise<void> {
  const [cardA, cardB] = await Promise.all([
    readProfileCardById(sql, userA),
    readProfileCardById(sql, userB),
  ]);
  if (cardA !== null) {
    const cache = profileCardToCache(cardA);
    await upsertFriendProfileCache(sql, {
      ownerId: userB,
      friendId: userA,
      ...cache,
      now,
    });
  }
  if (cardB !== null) {
    const cache = profileCardToCache(cardB);
    await upsertFriendProfileCache(sql, {
      ownerId: userA,
      friendId: userB,
      ...cache,
      now,
    });
  }
}

export async function clearFriendProfileCaches(
  sql: SqlClient,
  userA: string,
  userB: string
): Promise<void> {
  await deleteFriendProfileCachePair(sql, userA, userB);
}

export async function loadProfileCardsForUserIds(
  sql: SqlClient,
  userIds: readonly string[]
): Promise<readonly ProfileCard[]> {
  return readProfileCardsByIds(sql, userIds);
}
