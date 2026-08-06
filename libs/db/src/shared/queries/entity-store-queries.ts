import { defineQuery } from '@pkgs/sync-engine/queries/core/define-query';
import { sql } from '@pkgs/sql';
import { z } from 'zod';

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

export const ENTITY_STORE_QUERIES = [
  entityStoreCatalog,
  entityStoreOwned,
] as const;
