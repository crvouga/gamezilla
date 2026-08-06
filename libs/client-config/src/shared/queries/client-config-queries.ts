import { defineQuery } from '@pkgs/sync-engine/queries/core/define-query';
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

export const CLIENT_CONFIG_QUERIES = [clientConfig] as const;
