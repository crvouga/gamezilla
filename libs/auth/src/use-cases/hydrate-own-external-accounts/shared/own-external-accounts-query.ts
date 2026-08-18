import { sql } from '@pkgs/sql';
import { defineQuery } from '@pkgs/sync-engine/shared';

export const ownExternalAccounts = defineQuery({
  name: 'ownExternalAccounts',
  limit: 20,
  async run(ctx) {
    const rows = await ctx.db.query(sql`
      SELECT
        provider || ':' || external_id AS id,
        user_id, 
        provider, 
        external_id, 
        metadata, 
        created_at,
        deleted_at
      FROM auth_external_accounts
      WHERE user_id = ${ctx.env.actorId}
`);
    return { auth_external_accounts: rows };
  },
});
