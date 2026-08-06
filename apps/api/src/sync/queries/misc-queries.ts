import { defineQuery } from '@pkgs/queries/core/define-query';
import { sql } from '@pkgs/sql';
import { z } from 'zod';

export const clientConfig = defineQuery({
  name: 'clientConfig',
  params: z.object({}),
  hydrates: ['client_config'],
  limit: 1,
  async authorize(ctx) {
    return ctx.env.actorId.length > 0;
  },
  async run(ctx) {
    const rows = await ctx.db.query(sql`
      SELECT id, google_web_client_id FROM client_config LIMIT 1
    `);
    return { client_config: rows };
  },
});

export const entityStoreCatalog = defineQuery({
  name: 'entityStoreCatalog',
  params: z.object({}),
  hydrates: ['entity_store'],
  limit: 500,
  async authorize(ctx) {
    return ctx.env.actorId.length > 0;
  },
  async run(ctx) {
    const rows = await ctx.db.query(sql`
      SELECT
        id, namespace, type, external_id, owner_id,
        data, created_at, updated_at
      FROM entity_store
      WHERE owner_id IS NULL
      LIMIT 500
    `);
    return { entity_store: rows };
  },
});

export const entityStoreOwned = defineQuery({
  name: 'entityStoreOwned',
  params: z.object({}),
  hydrates: ['entity_store'],
  limit: 500,
  async authorize(ctx) {
    return ctx.env.actorId.length > 0;
  },
  async run(ctx) {
    const rows = await ctx.db.query(sql`
      SELECT
        id, namespace, type, external_id, owner_id,
        data, created_at, updated_at
      FROM entity_store
      WHERE owner_id = ${ctx.env.actorId}
      LIMIT 500
    `);
    return { entity_store: rows };
  },
});

export const inboxActive = defineQuery({
  name: 'inboxActive',
  params: z.object({}),
  hydrates: ['inbox_interactions'],
  limit: 500,
  async authorize(ctx) {
    return ctx.env.actorId.length > 0;
  },
  async run(ctx) {
    const rows = await ctx.db.query(sql`
      SELECT
        id, user_id, source_namespace, source_type, source_id,
        category, priority, group_key, title, subtitle, body,
        icon_key, avatar_fallback_label, avatar_config,
        deep_link_path, deep_link_params, actions, payload,
        expires_at, read_at, archived_at, dismissed_at,
        active, created_at, updated_at
      FROM inbox_interactions
      WHERE user_id = ${ctx.env.actorId} AND active = true
      LIMIT 500
    `);
    return { inbox_interactions: rows };
  },
});

export const MISC_QUERIES = [
  clientConfig,
  entityStoreCatalog,
  entityStoreOwned,
  inboxActive,
] as const;
