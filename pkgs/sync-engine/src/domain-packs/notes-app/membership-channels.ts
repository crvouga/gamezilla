import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { QueryChannelsCtx } from '../shared/push-payload';

function membershipKey(ids: readonly string[]): string {
  return [...ids].sort().join('\0');
}

async function loadMembershipSpaceIds(
  db: SqlClient,
  actorId: string
): Promise<string[]> {
  const rows = await db.query(sql<{ space_id: string }>`
    SELECT space_id FROM space_users
    WHERE user_id = ${actorId} AND _deleted_at IS NULL
    ORDER BY space_id ASC
  `);
  return rows.map((row) => row.space_id);
}

/**
 * Product-shaped membership channel cache: async load from local
 * `space_users`, then `topicRefresh` when the set changes.
 */
export function createSimMembershipChannels(args: {
  readonly db: SqlClient;
  readonly actorId: string;
}): {
  readonly getChannelsCtx: () => QueryChannelsCtx;
  readonly onBindTopicRefresh: (refresh: () => void) => void;
} {
  let membershipCache: string[] = [];
  let topicRefresh: (() => void) | null = null;
  return {
    onBindTopicRefresh: (refresh) => {
      topicRefresh = refresh;
    },
    getChannelsCtx: () => {
      void loadMembershipSpaceIds(args.db, args.actorId).then((ids) => {
        if (membershipKey(ids) === membershipKey(membershipCache)) return;
        membershipCache = ids;
        topicRefresh?.();
      });
      return {
        actorId: args.actorId,
        membershipSpaceIds: membershipCache,
      };
    },
  };
}
