import { spaceListChannels } from '@libs/db/shared/sync-topics';
import { sql } from '@pkgs/sql';
import { defineQuery } from '@pkgs/sync-engine/shared';
import { z } from 'zod';

export const mySpaces = defineQuery({
  name: 'mySpaces',
  params: z.object({}),
  hydrates: ['spaces'],
  limit: 200,
  channels: (_params, ctx) => spaceListChannels(ctx),
  async authorize(ctx) {
    return ctx.env.actorId.length > 0;
  },
  async run(ctx) {
    const actor = ctx.env.actorId;
    const rows = await ctx.db.query(sql`
      SELECT
        id, title, host_id, created_at, ended_at, visibility,
        host_account_id, host_member_id, _deleted_at
      FROM spaces
      WHERE host_member_id = ${actor}
         OR host_account_id = ${actor}
         OR id IN (
           SELECT space_id FROM space_users
           WHERE user_id = ${actor}
         )
      LIMIT 200
    `);
    return { spaces: rows };
  },
});

export const mySpaceUsers = defineQuery({
  name: 'mySpaceUsers',
  params: z.object({}),
  hydrates: ['space_users'],
  limit: 2000,
  channels: (_params, ctx) => spaceListChannels(ctx),
  async authorize(ctx) {
    return ctx.env.actorId.length > 0;
  },
  async run(ctx) {
    const actor = ctx.env.actorId;
    const rows = await ctx.db.query(sql`
      WITH related_spaces AS (
        SELECT id
        FROM spaces
        WHERE host_member_id = ${actor}
           OR host_account_id = ${actor}
           OR id IN (
             SELECT space_id
             FROM space_users
             WHERE user_id = ${actor}
           )
      )
      SELECT
        id,
        space_id,
        user_id,
        created_at,
        created_by_account_id,
        _deleted_at
      FROM space_users
      WHERE user_id = ${actor}
         OR space_id IN (SELECT id FROM related_spaces)
      LIMIT 2000
    `);
    return { space_users: rows };
  },
});

export const openSpaceSessions = defineQuery({
  name: 'openSpaceSessions',
  params: z.object({}),
  hydrates: ['space_open_sessions'],
  limit: 20,
  // Own user topic + membership rooms so peer end/leave pushes refresh sessions.
  channels: (_params, ctx) => spaceListChannels(ctx),
  async authorize(ctx) {
    return ctx.env.actorId.length > 0 && ctx.env.deviceId.length > 0;
  },
  async run(ctx) {
    const rows = await ctx.db.query(sql`
      SELECT id, space_id, device_id, opened_at, join_announced, _deleted_at
      FROM space_open_sessions
      WHERE device_id = ${ctx.env.deviceId}
      LIMIT 20
    `);
    return { space_open_sessions: rows };
  },
});

export const SPACE_QUERIES = [
  mySpaces,
  mySpaceUsers,
  openSpaceSessions,
] as const;
