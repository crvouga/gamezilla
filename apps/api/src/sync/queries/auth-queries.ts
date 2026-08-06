import { defineQuery } from '@pkgs/queries/core/define-query';
import { sql } from '@pkgs/sql';
import { z } from 'zod';

async function requireActor(ctx: {
  env: { actorId: string };
}): Promise<boolean> {
  return ctx.env.actorId.length > 0;
}

export const ownUser = defineQuery({
  name: 'ownUser',
  params: z.object({}),
  hydrates: ['users'],
  limit: 1,
  authorize: requireActor,
  async run(ctx) {
    const rows = await ctx.db.query(sql`
      SELECT id, created_at, is_anon
      FROM users
      WHERE id = ${ctx.env.actorId}
      LIMIT 1
    `);
    return { users: rows };
  },
});

export const ownDevices = defineQuery({
  name: 'ownDevices',
  params: z.object({}),
  hydrates: ['devices'],
  limit: 50,
  authorize: requireActor,
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
        last_seen_at
      FROM devices
      WHERE user_id = ${ctx.env.actorId}
      LIMIT 50
    `);
    return { devices: rows };
  },
});

export const ownExternalAccounts = defineQuery({
  name: 'ownExternalAccounts',
  params: z.object({}),
  hydrates: ['external_accounts'],
  limit: 20,
  authorize: requireActor,
  async run(ctx) {
    const rows = await ctx.db.query(sql`
      SELECT
        provider || ':' || external_id AS id,
        user_id, 
        provider, 
        external_id, 
        metadata, 
        created_at
      FROM external_accounts
      WHERE user_id = ${ctx.env.actorId}
      LIMIT 20
    `);
    return { external_accounts: rows };
  },
});

export const AUTH_QUERIES = [ownUser, ownDevices, ownExternalAccounts] as const;
