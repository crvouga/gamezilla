import { join, sql } from '@pkgs/sql';
import { defineQuery } from '@pkgs/sync-engine/shared';

type SpaceRow = {
  readonly id: string;
  readonly title: string;
  readonly owner_id: string;
  readonly deleted_at: string | null;
};

function dedupeSpacesById(rows: readonly SpaceRow[]): SpaceRow[] {
  const byId = new Map<string, SpaceRow>();
  for (const row of rows) {
    if (!byId.has(row.id)) byId.set(row.id, row);
  }
  return [...byId.values()].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  );
}

/**
 * Membership-scoped hydrate — wakes follow live held rows via topic-map
 * plus host default entry (user topic). Also includes friend-owned spaces
 * so cold hydrate matches friend topic wakes on createSpace.
 */
export const spaceMembershipQuery = defineQuery({
  name: 'spaceMembership',
  limit: 500,
  async run({ db, env }) {
    const memberships = await db.query(sql<{
      id: string;
      space_id: string;
      user_id: string;
      deleted_at: string | null;
    }>`
      SELECT id, space_id, user_id, deleted_at FROM spaces_users
      WHERE user_id = ${env.actorId}
      ORDER BY id ASC
`);
    const liveSpaceIds: string[] = [];
    for (const row of memberships) {
      const deletedAt = row['deleted_at'] as string | null;
      const spaceId = row['space_id'] as string;
      if (deletedAt !== null) continue;
      liveSpaceIds.push(spaceId);
    }

    const friendPeers = (await db.query(sql<{ readonly friend_id: string }>`
      SELECT CASE
        WHEN user_low = ${env.actorId} THEN user_high
        ELSE user_low
      END AS friend_id
      FROM friends_friendships
      WHERE user_low = ${env.actorId} OR user_high = ${env.actorId}
    `)) as unknown as readonly { readonly friend_id: string }[];
    const peerIds: string[] = [
      ...new Set(
        friendPeers
          .map((r) => r.friend_id)
          .filter((id) => id.length > 0 && id !== env.actorId)
      ),
    ];

    let memberSpaces: SpaceRow[] = [];
    let notes: readonly Record<string, unknown>[] = [];
    if (liveSpaceIds.length > 0) {
      const idList = join(liveSpaceIds);
      memberSpaces = (await db.query(sql<SpaceRow>`
        SELECT id, title, owner_id, deleted_at FROM spaces
        WHERE id IN (${idList})
        ORDER BY id ASC
      `)) as SpaceRow[];
      notes = await db.query(sql`
        SELECT id, folder_id, space_id, title, body, owner_id, deleted_at
        FROM notes
        WHERE space_id IN (${idList})
        ORDER BY id ASC
      `);
    }

    let friendSpaces: SpaceRow[] = [];
    if (peerIds.length > 0) {
      friendSpaces = (await db.query(sql<SpaceRow>`
        SELECT id, title, owner_id, deleted_at FROM spaces
        WHERE owner_id IN (${join(peerIds)})
        ORDER BY id ASC
      `)) as SpaceRow[];
    }

    return {
      spaces: dedupeSpacesById([...memberSpaces, ...friendSpaces]),
      spaces_users: memberships,
      notes,
    };
  },
});

export const SPACE_MEMBERSHIP_SESSION = {
  name: 'spaceMembership',
  params: {},
} as const;

/**
 * Device-scoped open sessions. Peers on the same actor must not receive
 * another install's rows via user-topic fanout (see scenario test).
 */
export const openSpaceSessionsQuery = defineQuery({
  name: 'openSpaceSessions',
  limit: 20,
  async run({ db, env }) {
    const rows = await db.query(sql<{
      id: string;
      space_id: string;
      device_id: string;
      opened_at: string;
      deleted_at: string | null;
    }>`
      SELECT id, space_id, device_id, opened_at, deleted_at
      FROM spaces_open_sessions
      WHERE device_id = ${env.deviceId}
      ORDER BY id ASC
`);
    return { spaces_open_sessions: rows };
  },
});

export const OPEN_SPACE_SESSIONS_SESSION = {
  name: 'openSpaceSessions',
  params: {},
} as const;
