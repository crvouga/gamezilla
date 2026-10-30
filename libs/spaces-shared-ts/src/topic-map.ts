import type { Topic } from '@pkgs/pubsub-root-shared-ts/topic';
import sql from '@pkgs/sql-root-shared-ts/sql';
import type { MutationDb } from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { HeldRows, TopicMap } from '@pkgs/sync-engine-shared-ts/topic-map';

function hostTopics(row: Record<string, unknown>): Topic[] {
  const out: Topic[] = [];
  for (const key of ['host_member_id', 'host_account_id', 'host_id'] as const) {
    const v = row[key];
    if (typeof v === 'string' && v.length > 0) out.push(`user:${v}`);
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
    .map((id) => `user:${id}` as Topic);
}

async function hostFriendTopics(
  db: MutationDb,
  hostAccountId: string,
  hostMemberId: string
): Promise<Topic[]> {
  const hostIds = [
    ...new Set([hostAccountId, hostMemberId].filter((id) => id.length > 0)),
  ];
  if (hostIds.length === 0) {
    return [];
  }
  const [hostA, hostB] = hostIds;
  const rows = await db.query(sql<{
    readonly user_low: string;
    readonly user_high: string;
  }>`
    SELECT user_low, user_high
    FROM friends_friendships
    WHERE deleted_at IS NULL
      AND (
        user_low IN (${hostA}, ${hostB ?? hostA})
        OR user_high IN (${hostA}, ${hostB ?? hostA})
      )
  `);
  const topics: Topic[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const hostId of hostIds) {
      const friendId =
        row.user_low === hostId
          ? row.user_high
          : row.user_high === hostId
            ? row.user_low
            : '';
      if (friendId.length > 0 && !seen.has(friendId)) {
        seen.add(friendId);
        topics.push(`user:${friendId}` as Topic);
      }
    }
  }
  return topics;
}

/**
 * The broker grants a room only while its space is live, so a membership in an
 * ended space must not subscribe to it: the refusal never settles the session.
 */
function spaceHasEnded(held: HeldRows, spaceId: string): boolean {
  return (held['spaces'] ?? []).some(
    (space) => space['id'] === spaceId && space['ended_at'] != null
  );
}

export const SPACES_TOPIC_MAP = {
  spaces: {
    async topics(row, ctx, db) {
      const id = String(row['id'] ?? '');
      const base: Topic[] = [
        ...(id.length > 0 ? [`room:${id}` as Topic] : []),
        `user:${ctx.actorId}`,
        ...hostTopics(row),
      ];
      if (db === undefined) {
        return [...new Set(base)];
      }
      const friendTopics = await hostFriendTopics(
        db,
        String(row['host_account_id'] ?? ''),
        String(row['host_member_id'] ?? '')
      );
      if (row['ended_at'] != null) {
        const party = await partyUserTopics(db, id);
        return [...new Set([...base, ...party, ...friendTopics])];
      }
      return [...new Set([...base, ...friendTopics])];
    },
    // Space-row queries need the room's updates too: the membership query
    // hydrates a different table and cannot refresh a renamed space for them.
    subscribeTopics(row, ctx, held) {
      const id = String(row['id'] ?? '');
      if (
        id.length === 0 ||
        row['ended_at'] != null ||
        row['deleted_at'] != null
      ) {
        return [];
      }
      const member = (held['spaces_users'] ?? []).some(
        (membership) =>
          membership['space_id'] === id &&
          membership['user_id'] === ctx.actorId &&
          membership['deleted_at'] == null
      );
      return member ? [`room:${id}` as Topic] : [];
    },
  },
  spaces_users: {
    topics(row) {
      const spaceId = String(row['space_id'] ?? '');
      const userId = String(row['user_id'] ?? '');
      const out: Topic[] = [];
      if (spaceId.length > 0) out.push(`room:${spaceId}`);
      if (userId.length > 0) out.push(`user:${userId}`);
      return out;
    },
    // Held-row subscribe: only the actor's membership rows drive room topics.
    subscribeTopics(row, ctx, held) {
      if (row['user_id'] !== ctx.actorId) return [];
      const spaceId = String(row['space_id'] ?? '');
      if (spaceId.length === 0 || spaceHasEnded(held, spaceId)) return [];
      return [`room:${spaceId}` as Topic];
    },
  },
  spaces_open_sessions: {
    topics() {
      return [];
    },
    fallbackTopics() {
      return [];
    },
  },
} satisfies TopicMap;
