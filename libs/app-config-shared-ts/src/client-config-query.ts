import sql from '@pkgs/sql-root-shared-ts/sql';
import { defineQuery } from '@pkgs/sync-engine-shared-ts/define-query';
import { ClientConfigKey } from './client-config-keys';
import { clientPermissionPolicy } from './client-permission-policy';
import { clientConfigChannels } from './sync-topics';

function createClientConfigQuery(includeOwnRosterEntry: boolean) {
  return defineQuery({
    name: 'clientConfig',
    entryChannel: () => clientConfigChannels(),
    async run(ctx) {
      const rows = await ctx.db.query(
        sql`SELECT id, value, deleted_at FROM client_config`
      );
      const accountId = includeOwnRosterEntry ? ctx.env.accountId : null;
      return {
        client_config: rows.map((row) =>
          row['id'] === ClientConfigKey.permissionPolicy
            ? { ...row, value: clientPermissionPolicy(row['value'], accountId) }
            : row
        ),
      };
    },
  });
}

export const clientConfig = createClientConfigQuery(true);
export const CLIENT_CONFIG_QUERIES = [clientConfig] as const;
export const productClientConfig = createClientConfigQuery(false);
