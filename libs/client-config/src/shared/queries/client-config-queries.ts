import { clientConfigChannels } from '@libs/db/shared/sync-topics';
import { sql } from '@pkgs/sql';
import { defineQuery } from '@pkgs/sync-engine/shared';

export const clientConfig = defineQuery({
  name: 'clientConfig',
  entryChannel: () => clientConfigChannels(),
  async run(ctx) {
    const rows = await ctx.db.query(sql`
      SELECT id, google_web_client_id, _deleted_at FROM client_config
`);
    return { client_config: rows };
  },
});

export const CLIENT_CONFIG_QUERIES = [clientConfig] as const;
