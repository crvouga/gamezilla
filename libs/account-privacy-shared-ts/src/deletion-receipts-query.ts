import sql from '@pkgs/sql-root-shared-ts/sql';
import { defineQuery } from '@pkgs/sync-engine-shared-ts/define-query';

/** A former device may retain the deletion acknowledgment, without account contents. */
export const deletionReceipts = defineQuery({
  name: 'deletionReceipts',
  allowAnon: true,
  async run(ctx) {
    return {
      profile_deletion_receipts: await ctx.db.query(sql`
      SELECT p.*
      FROM profile_deletion_receipts p
      JOIN auth_account_devices d ON d.user_id = p.owner_id
      WHERE d.device_id = ${ctx.env.deviceId}
    `),
    };
  },
});
