import sql from '@pkgs/sql-root-shared-ts/sql';
import { defineQuery } from '@pkgs/sync-engine-shared-ts/define-query';
import { clientConfigChannels } from './sync-topics';

export const clientConfig = defineQuery({
  name: 'clientConfig',
  entryChannel: () => clientConfigChannels(),
  async run(ctx) {
    const rows = await ctx.db.query(
      sql`SELECT id, value, deleted_at FROM client_config`
    );
    return { client_config: rows };
  },
});

export const CLIENT_CONFIG_QUERIES = [clientConfig] as const;
