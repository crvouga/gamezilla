import {
  chessPuzzlesTopic,
  clientConfigTopic,
  roomTopic,
  userTopic,
} from '@libs/db/shared/sync-topics';
import type { Topic } from '@pkgs/pubsub/interface';
import { sql } from '@pkgs/sql';
import type { MutationDb } from '@pkgs/sync-engine/shared';
import { defineTopicMap } from '@pkgs/sync-engine/shared';

function hostTopics(row: Record<string, unknown>): Topic[] {
  const out: Topic[] = [];
  for (const key of ['host_member_id', 'host_account_id', 'host_id'] as const) {
    const v = row[key];
    if (typeof v === 'string' && v.length > 0) out.push(userTopic(v));
  }
  return out;
}

async function partyUserTopics(
  db: MutationDb,
  spaceId: string
): Promise<Topic[]> {
  const rows = await db.query(sql<{ readonly user_id: string }>`
    SELECT DISTINCT user_id FROM spaces_users
    WHERE space_id = ${spaceId}
  `);
  const hosts = await db.query(sql<{
    readonly host_member_id: string | null;
    readonly host_account_id: string | null;
  }>`
    SELECT host_member_id, host_account_id FROM spaces
    WHERE id = ${spaceId}
    LIMIT 1
  `);
  const host = hosts[0];
  return [
    ...rows.map((r) => r.user_id),
    host?.host_member_id ?? '',
    host?.host_account_id ?? '',
  ]
    .filter((id) => id.length > 0)
    .map((id) => userTopic(id));
}

/** Product domain topic map — registered on API + client sync hosts. */
export const appTopicMap = defineTopicMap({
  spaces: {
    // topic-map-db: peer user wake when ended_at set
    async topics(row, ctx, db) {
      const id = String(row['id'] ?? '');
      const base: Topic[] = [
        ...(id.length > 0 ? [roomTopic(id)] : []),
        userTopic(ctx.actorId),
        ...hostTopics(row),
      ];
      if (row['ended_at'] == null || db === undefined) {
        return [...new Set(base)];
      }
      const party = await partyUserTopics(db, id);
      return [...new Set([...base, ...party])];
    },
  },
  spaces_users: {
    topics(row) {
      const spaceId = String(row['space_id'] ?? '');
      const userId = String(row['user_id'] ?? '');
      const out: Topic[] = [];
      if (spaceId.length > 0) out.push(roomTopic(spaceId));
      if (userId.length > 0) out.push(userTopic(userId));
      return out;
    },
  },
  spaces_open_sessions: {
    // Device-private: writer already has the local mutation row; hydrate on
    // reconnect via openSpaceSessions (WHERE device_id = env.deviceId). Do not
    // wake user: — same-account peers must not receive open-session images.
    topics() {
      return [];
    },
    fallbackTopics() {
      return [];
    },
  },
  friends_friendships: {
    topics(row) {
      return [
        userTopic(String(row['user_low'])),
        userTopic(String(row['user_high'])),
      ];
    },
  },
  friends_requests: {
    topics(row) {
      return [
        userTopic(String(row['from_user_id'])),
        userTopic(String(row['to_user_id'])),
      ];
    },
  },
  friends_blocks: {
    topics(row) {
      return [
        userTopic(String(row['blocker_id'])),
        userTopic(String(row['blocked_id'])),
      ];
    },
  },
  profile: {
    topics(row, ctx) {
      const id = String(row['id'] ?? ctx.actorId);
      return [userTopic(id)];
    },
    // Touch-only capture (e.g. AlaSQL stripped UPDATE RETURNING) still wakes
    // the actor channel so peers refetch.
    fallbackTopics(ctx) {
      return [userTopic(ctx.actorId)];
    },
  },
  auth_users: {
    topics(row, ctx) {
      return [userTopic(String(row['id'] ?? ctx.actorId))];
    },
  },
  auth_devices: {
    topics(_row, ctx) {
      return [userTopic(ctx.actorId)];
    },
  },
  auth_external_accounts: {
    topics(_row, ctx) {
      return [userTopic(ctx.actorId)];
    },
  },
  chess_puzzle_profiles: {
    topics(_row, ctx) {
      return [userTopic(ctx.actorId)];
    },
  },
  chess_puzzle_interactions: {
    topics(_row, ctx) {
      return [userTopic(ctx.actorId)];
    },
  },
  chess_puzzles: {
    topics() {
      return [chessPuzzlesTopic()];
    },
    fallbackTopics() {
      return [chessPuzzlesTopic()];
    },
  },
  client_config: {
    topics() {
      return [clientConfigTopic()];
    },
    fallbackTopics() {
      return [clientConfigTopic()];
    },
  },
  notifications: {
    topics(row, ctx) {
      const uid = String(row['user_id'] ?? ctx.actorId);
      return [userTopic(uid)];
    },
  },
});

export function appDefaultEntryChannel(
  _params: unknown,
  ctx: { readonly actorId: string }
): Topic[] {
  return [userTopic(ctx.actorId)];
}
