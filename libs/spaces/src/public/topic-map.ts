import type { Topic } from '@pkgs/pubsub/interface';
import { sql } from '@pkgs/sql';
import type { MutationDb, TopicMap } from '@pkgs/sync-engine/shared';

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

export const SPACES_TOPIC_MAP = {
  spaces: {
    async topics(row, ctx, db) {
      const id = String(row['id'] ?? '');
      const base: Topic[] = [
        ...(id.length > 0 ? [`room:${id}` as Topic] : []),
        `user:${ctx.actorId}`,
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
      if (spaceId.length > 0) out.push(`room:${spaceId}`);
      if (userId.length > 0) out.push(`user:${userId}`);
      return out;
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
