import { sql } from '@pkgs/sql';
import { defineQuery } from '@pkgs/sync-engine/shared';

export const inboxActive = defineQuery({
  name: 'inboxActive',
  limit: 500,
  async run(ctx) {
    const rows = await ctx.db.query(sql`
      SELECT
        id, user_id, source_namespace, source_type, source_id,
        category, priority, group_key, title, subtitle, body,
        icon_key, avatar_fallback_label, avatar_config,
        deep_link_path, deep_link_params, actions, payload,
        expires_at, read_at, archived_at, dismissed_at,
        active, created_at, updated_at, _deleted_at
      FROM inbox_interactions
      WHERE user_id = ${ctx.env.actorId} AND active = true
`);
    return { inbox_interactions: rows };
  },
});

export const INBOX_QUERIES = [inboxActive] as const;
