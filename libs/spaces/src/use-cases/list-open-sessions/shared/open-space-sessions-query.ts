import { sql } from '@pkgs/sql';
import { defineQuery } from '@pkgs/sync-engine/shared';

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
