import { sql } from '@pkgs/sql';
import { defineQuery } from '@pkgs/sync-engine/shared';

export const notificationsActive = defineQuery({
  name: 'notificationsActive',
  limit: 500,
  async run(ctx) {
    const rows = await ctx.db.query(sql`
      SELECT
        id, user_id, source_namespace, source_type, source_id,
        category, priority, group_key, title, subtitle, body,
        icon_key, avatar_fallback_label, avatar_config,
        deep_link_path, deep_link_params, actions, payload,
        expires_at, read_at, archived_at, dismissed_at,
        active, created_at, updated_at, deleted_at
      FROM notifications
      WHERE user_id = ${ctx.env.actorId} AND active IS TRUE
`);
    return { notifications: rows };
  },
});

export const NOTIFICATIONS_QUERIES = [notificationsActive] as const;
