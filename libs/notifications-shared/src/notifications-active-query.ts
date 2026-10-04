import sql from '@pkgs/sql-root-shared/sql';
import { defineQuery } from '@pkgs/sync-engine-shared/define-query';

/**
 * Snapshot must include inactive rows. Deactivate sets `active = false` (not
 * soft-delete); merge has no absence GC, so filtering `active IS TRUE` here
 * leaves stale live cards on clients after accept/decline. Client inbox SQL
 * still filters `active IS TRUE` for display.
 */
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
      WHERE user_id = ${ctx.env.actorId}
    `);
    return { notifications: rows };
  },
});

export const NOTIFICATIONS_QUERIES = [notificationsActive] as const;
