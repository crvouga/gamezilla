import type { AccountPrivacyContribution } from '@libs/sub-shared/account-privacy';
import sql from '@pkgs/sql-root-shared/sql';

export const NOTIFICATIONS_PRIVACY: AccountPrivacyContribution = {
  name: 'notifications',
  snapshot: async ({ tx, env }) =>
    tx.query(
      sql<
        Record<string, unknown>
      >`SELECT category, title, subtitle, body, created_at, read_at, dismissed_at FROM notifications WHERE user_id = ${env.actorId}`
    ),
  withdraw: async ({ tx, env }) => {
    await tx.run(
      sql`UPDATE notifications SET active = ${false}, deleted_at = ${(env.serverNow ?? env.now)().toISOString()} WHERE user_id = ${env.actorId}`
    );
  },
  erase: async ({ tx, env }) => {
    await tx.run(
      sql`UPDATE notifications SET user_id = ${null}, title = ${null}, subtitle = ${null}, body = ${null}, payload = ${null}, actions = ${null}, avatar_config = ${null}, avatar_fallback_label = ${null}, deep_link_params = ${null}, deep_link_path = ${null} WHERE user_id = ${env.actorId}`
    );
  },
};
