import type { Topic } from '@pkgs/pubsub/interface';
import { sql } from '@pkgs/sql';
import type { MutationDb } from '../../../../mutations/core/types';
import { defineTopicMap } from '../../../../shared/topic-map';
import { NOTES_WORLD_TOPIC, roomTopic, userTopic } from './topics';

async function ownerFriendTopics(
  db: MutationDb,
  ownerId: string
): Promise<readonly Topic[]> {
  if (ownerId.length === 0) return [];
  const rows = await db.query(sql<{
    readonly user_low: string;
    readonly user_high: string;
  }>`
    SELECT user_low, user_high
    FROM friends_friendships
    WHERE deleted_at IS NULL
      AND (user_low = ${ownerId} OR user_high = ${ownerId})
  `);
  const topics: Topic[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const friendId =
      row.user_low === ownerId
        ? row.user_high
        : row.user_high === ownerId
          ? row.user_low
          : '';
    if (friendId.length > 0 && !seen.has(friendId)) {
      seen.add(friendId);
      topics.push(userTopic(friendId));
    }
  }
  return topics;
}

export const acmeTopicMap = defineTopicMap({
  notes: {
    topics(row, ctx) {
      const spaceId = row['space_id'];
      const room =
        typeof spaceId === 'string' && spaceId.length > 0
          ? [roomTopic(spaceId)]
          : [];
      return [NOTES_WORLD_TOPIC, userTopic(ctx.actorId), ...room];
    },
  },
  folders: {
    topics(_row, ctx) {
      return [NOTES_WORLD_TOPIC, userTopic(ctx.actorId)];
    },
  },
  tags: {
    topics(_row, ctx) {
      return [NOTES_WORLD_TOPIC, userTopic(ctx.actorId)];
    },
  },
  spaces: {
    // Room subscribe/publish for membership comes from spaces_users images.
    // Holding a stale spaces row after leave must not keep room:{id}.
    // topic-map-db: wake friends of owner so lobby peers see live spaces
    async topics(row, ctx, db) {
      const base = [userTopic(ctx.actorId)];
      if (row['deleted_at'] != null || db === undefined) {
        return base;
      }
      const ownerId = String(row['owner_id'] ?? '');
      const friends = await ownerFriendTopics(db, ownerId);
      return [...new Set([...base, ...friends])];
    },
  },
  spaces_users: {
    topics(row, ctx) {
      const spaceId = String(row['space_id'] ?? '');
      const userId = String(row['user_id'] ?? '');
      return [
        ...(spaceId.length > 0 ? [roomTopic(spaceId)] : []),
        ...(userId.length > 0 ? [userTopic(userId)] : []),
        userTopic(ctx.actorId),
      ];
    },
  },
  // Device-private: writer has the local mutation row; hydrate via
  // openSpaceSessions (device_id filter). Empty topics so row images do not
  // ride sibling spaces/spaces_users wakes on user:{actor}.
  spaces_open_sessions: {
    topics() {
      return [];
    },
    fallbackTopics() {
      return [];
    },
  },
  profile: {
    topics(row, ctx) {
      return [userTopic(String(row['id'] ?? ctx.actorId))];
    },
  },
  friends_friendships: {
    topics(row) {
      const low = String(row['user_low'] ?? '');
      const high = String(row['user_high'] ?? '');
      const out: Topic[] = [];
      if (low.length > 0) out.push(userTopic(low));
      if (high.length > 0) out.push(userTopic(high));
      return out;
    },
  },
});

export function acmeDefaultEntryChannel(
  _params: unknown,
  ctx: { readonly actorId: string }
) {
  return [userTopic(ctx.actorId)];
}
