import { sql } from '@pkgs/sql';
import { defineQuery } from '@pkgs/sync-engine/shared';

/**
 * The devices that have been signed into the actor's account, tombstones
 * included: a tombstone is how a device that signed out leaves the list.
 */
export const ownAccountDevices = defineQuery({
  name: 'ownAccountDevices',
  limit: 500,
  async run(ctx) {
    const rows = await ctx.db.query(sql`
      SELECT id, user_id, device_id, created_at, updated_at, deleted_at
      FROM auth_account_devices
      WHERE user_id = ${ctx.env.actorId}
`);
    return { auth_account_devices: rows };
  },
});
