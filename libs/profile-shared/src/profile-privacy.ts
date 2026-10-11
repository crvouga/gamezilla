import type { AccountPrivacyContribution } from '@libs/sub-shared/account-privacy';
import sql from '@pkgs/sql-root-shared/sql';

export const PROFILE_PRIVACY: AccountPrivacyContribution = {
  name: 'profile',
  snapshot: async ({ tx, env }) =>
    tx.query(
      sql<
        Record<string, unknown>
      >`SELECT username, avatar_config, username_changed_at, created_at FROM profile WHERE id = ${env.actorId} AND deleted_at IS NULL`
    ),
  withdraw: async ({ tx, env }) => {
    await tx.run(
      sql`UPDATE profile SET deleted_at = ${(env.serverNow ?? env.now)().toISOString()} WHERE id = ${env.actorId}`
    );
  },
  erase: async ({ tx, env }) => {
    await tx.run(
      sql`UPDATE profile SET username = ${''}, username_norm = ${null}, avatar_config = ${null}, username_changed_at = ${null} WHERE id = ${env.actorId} AND deleted_at IS NOT NULL`
    );
  },
};
