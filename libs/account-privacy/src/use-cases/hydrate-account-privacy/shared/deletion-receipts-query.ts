import { sql } from '@pkgs/sql';
import { defineQuery } from '@pkgs/sync-engine/shared';

/** A former device may retain the deletion acknowledgment, without account contents. */
export const deletionReceipts = defineQuery({
  name: 'deletionReceipts',
  allowAnon: true,
  async run(ctx) {
    return { profile_account_privacy: await ctx.db.query(sql`
      SELECT p.id, p.owner_id, p.created_at, p.updated_at, p.deleted_at, p.deletion_at, p.erase_by, p.erased_at, p.export_status, p.cancellation_status
      FROM profile_account_privacy p
      JOIN auth_account_devices d ON d.user_id = p.owner_id
      WHERE d.device_id = ${ctx.env.deviceId} AND p.deletion_at IS NOT NULL
    `) };
  },
});
