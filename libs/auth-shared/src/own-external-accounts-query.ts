import sql from '@pkgs/sql-root-shared/sql';
import { defineQuery } from '@pkgs/sync-engine-shared/define-query';

export const ownExternalAccounts = defineQuery({
  name: 'ownExternalAccounts',
  limit: 20,
  async run(ctx) {
    const rows = await ctx.db.query(sql<Record<string, unknown>>`
      SELECT
        id,
        user_id,
        provider, 
        external_id,
        metadata,
        created_at,
        updated_at,
        deleted_at
      FROM auth_external_accounts
      WHERE user_id = ${ctx.env.actorId}
        OR (user_id IN (
          SELECT user_id FROM auth_account_devices WHERE device_id = ${ctx.env.deviceId}
        ))
      ORDER BY id
`);
    return {
      auth_external_accounts: rows
        .filter(
          (row) =>
            row['user_id'] === ctx.env.actorId || row['deleted_at'] != null
        )
        .map((row) =>
          row['deleted_at'] == null
            ? row
            : { ...row, external_id: null, metadata: null }
        )
        .sort(
          (a, b) =>
            Number(a['deleted_at'] == null) - Number(b['deleted_at'] == null)
        ),
    };
  },
});
