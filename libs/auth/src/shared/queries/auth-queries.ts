import { sql } from '@pkgs/sql';
import { defineQuery } from '@pkgs/sync-engine/shared';

export const ownUser = defineQuery({
  name: 'ownUser',
  async run(ctx) {
    const rows = await ctx.db.query(sql`
      SELECT id, created_at, is_anon, _deleted_at
      FROM users
      WHERE id = ${ctx.env.actorId}
`);
    return { users: rows };
  },
});

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
        _deleted_at
      FROM devices
      WHERE user_id = ${ctx.env.actorId}
`);
    return { devices: rows };
  },
});

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
        _deleted_at
      FROM external_accounts
      WHERE user_id = ${ctx.env.actorId}
`);
    return { external_accounts: rows };
  },
});

export const AUTH_QUERIES = [ownUser, ownDevices, ownExternalAccounts] as const;
