import { sql } from '@pkgs/sql';
import { defineQuery } from '@pkgs/sync-engine/shared';

export const ownDevices = defineQuery({
  name: 'ownDevices',
  limit: 50,
  async run(ctx) {
    const rows = await ctx.db.query(sql`
      SELECT
        id, 
        user_id, 
        created_at, 
        platform, 
        os_name, 
        os_version,
        device_model_name, 
        device_brand, 
        device_name, 
        app_version,
        app_build_number, 
        user_agent, 
        first_seen_at, 
        last_seen_at,
        deleted_at
      FROM auth_devices
      WHERE user_id = ${ctx.env.actorId}
`);
    return { auth_devices: rows };
  },
});
