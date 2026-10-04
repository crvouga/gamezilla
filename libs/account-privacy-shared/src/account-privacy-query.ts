import sql from '@pkgs/sql-root-shared/sql';
import { defineQuery } from '@pkgs/sync-engine-shared/define-query';

export const ownAccountPrivacy = defineQuery({
  name: 'ownAccountPrivacy',
  async run(ctx) {
    return {
      profile_account_privacy: await ctx.db.query(sql`
      SELECT id, owner_id, created_at, updated_at, deleted_at, deletion_at, erase_by, erased_at, export_status, requested_at, ready_at, cancellation_status, legal_purpose, legal_end_condition
      FROM profile_account_privacy WHERE owner_id = ${ctx.env.actorId}
    `),
    };
  },
});
