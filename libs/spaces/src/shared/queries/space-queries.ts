import { sql } from '@pkgs/sql';
import { defineQuery } from '@pkgs/sync-engine/shared';

export const mySpaces = defineQuery({
  name: 'mySpaces',
  limit: 200,
  async run(ctx) {
    const actor = ctx.env.actorId;
    const rows = await ctx.db.query(sql`
      SELECT
        id, title, host_id, created_at, ended_at, visibility,
        host_account_id, host_member_id, deleted_at
      FROM spaces
      WHERE host_member_id = ${actor}
         OR host_account_id = ${actor}
         OR id IN (
           SELECT space_id FROM spaces_users
           WHERE user_id = ${actor}
         )
`);
    return { spaces: rows };
  },
});

export const mySpaceUsers = defineQuery({
  name: 'mySpaceUsers',
  async run(ctx) {
    const actor = ctx.env.actorId;
    // Nested subqueries (not WITH) keep the plan simple for every SQLite driver.
    const rows = await ctx.db.query(sql`
      SELECT
        id,
        space_id,
        user_id,
        created_at,
        created_by_account_id,
        deleted_at
      FROM spaces_users
      WHERE user_id = ${actor}
         OR space_id IN (
           SELECT id
           FROM spaces
           WHERE host_member_id = ${actor}
              OR host_account_id = ${actor}
              OR id IN (
                SELECT space_id
                FROM spaces_users
                WHERE user_id = ${actor}
              )
         )
`);
    return { spaces_users: rows };
  },
});

export const openSpaceSessions = defineQuery({
  name: 'openSpaceSessions',
  limit: 20,
  async run(ctx) {
    const rows = await ctx.db.query(sql`
      SELECT id, space_id, device_id, opened_at, join_announced, deleted_at
      FROM spaces_open_sessions
      WHERE device_id = ${ctx.env.deviceId}
`);
    return { spaces_open_sessions: rows };
  },
});

export const SPACE_QUERIES = [
  mySpaces,
  mySpaceUsers,
  openSpaceSessions,
] as const;
