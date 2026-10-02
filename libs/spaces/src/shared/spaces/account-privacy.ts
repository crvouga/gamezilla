import type { AccountPrivacyContribution } from '@libs/feature/public/account-privacy';
import { sql } from '@pkgs/sql';

export const SPACES_PRIVACY: AccountPrivacyContribution = {
  name: 'spaces',
  snapshot: async ({ tx, env }) => ({
    hosted: await tx.query(
      sql<
        Record<string, unknown>
      >`SELECT id, title, created_at, ended_at, visibility FROM spaces WHERE host_id = ${env.actorId} OR host_account_id = ${env.actorId} OR host_member_id = ${env.actorId}`
    ),
    joined: await tx.query(
      sql<
        Record<string, unknown>
      >`SELECT space_id, created_at FROM spaces_users WHERE user_id = ${env.actorId}`
    ),
  }),
  withdraw: async ({ tx, env }) => {
    const now = (env.serverNow ?? env.now)().toISOString();
    await tx.run(
      sql`UPDATE spaces SET ended_at = ${now} WHERE (host_id = ${env.actorId} OR host_account_id = ${env.actorId} OR host_member_id = ${env.actorId}) AND ended_at IS NULL`
    );
    await tx.run(
      sql`UPDATE spaces_users SET deleted_at = ${now} WHERE user_id = ${env.actorId}`
    );
    await tx.run(
      sql`UPDATE spaces_open_sessions SET deleted_at = ${now} WHERE device_id IN (SELECT device_id FROM auth_account_devices WHERE user_id = ${env.actorId})`
    );
  },
  erase: async ({ tx, env }) => {
    await tx.run(
      sql`UPDATE spaces SET host_id = ${null}, host_account_id = ${null}, host_member_id = ${null}, title = ${'Ended space'} WHERE host_id = ${env.actorId} OR host_account_id = ${env.actorId} OR host_member_id = ${env.actorId}`
    );
    await tx.run(
      sql`UPDATE spaces_users SET user_id = ${null}, created_by_account_id = ${null} WHERE user_id = ${env.actorId}`
    );
  },
};
