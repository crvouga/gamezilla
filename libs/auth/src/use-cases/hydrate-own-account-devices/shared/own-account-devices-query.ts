import { sql } from '@pkgs/sql';
import { defineQuery } from '@pkgs/sync-engine/shared';

/**
 * The devices that have been signed into the actor's account, and this
 * device's own time in every account, tombstones included: a tombstone is how
 * a device that signed out leaves the account's list, and how the device
 * itself hears it is signed in there no longer — it signs out first and the
 * tombstone is written after, when it is no longer the account and would
 * never see that account's rows again.
 */
export const ownAccountDevices = defineQuery({
  name: 'ownAccountDevices',
  limit: 500,
  async run(ctx) {
    const rows = await ctx.db.query(sql`
      SELECT id, user_id, device_id, created_at, updated_at, deleted_at
      FROM auth_account_devices
      WHERE user_id = ${ctx.env.actorId}
         OR device_id = ${ctx.env.deviceId}
`);
    return { auth_account_devices: rows };
  },
});
