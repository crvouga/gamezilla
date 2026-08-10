import { join, sql } from '@pkgs/sql';
import { defineQuery } from '@pkgs/sync-engine/shared';

/**
 * Membership-scoped hydrate — wakes follow live held rows via topic-map
 * plus host default entry (user topic).
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
    if (liveSpaceIds.length === 0) {
      return { spaces: [], spaces_users: memberships, notes: [] };
    }
    const idList = join(liveSpaceIds);
    const spaces = await db.query(sql<{
      id: string;
      title: string;
      owner_id: string;
      deleted_at: string | null;
    }>`
      SELECT id, title, owner_id, deleted_at FROM spaces
      WHERE id IN (${idList})
      ORDER BY id ASC
`);
    const notes = await db.query(sql<{
      id: string;
      folder_id: string | null;
      space_id: string | null;
      title: string;
      body: string;
      owner_id: string;
      deleted_at: string | null;
    }>`
      SELECT id, folder_id, space_id, title, body, owner_id, deleted_at
      FROM notes
      WHERE space_id IN (${idList})
      ORDER BY id ASC
`);
    return { spaces, spaces_users: memberships, notes };
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
