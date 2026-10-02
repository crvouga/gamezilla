import type { AccountPrivacyContribution } from '@libs/feature/public/account-privacy';
import { sql } from '@pkgs/sql';

export const PERMISSIONS_PRIVACY: AccountPrivacyContribution = {
  name: 'usage',
  snapshot: async ({ tx, env }) =>
    tx.query(
      sql<
        Record<string, unknown>
      >`SELECT quota, amount, consumed_at FROM permissions_quota_ledger WHERE owner_id = ${env.actorId}`
    ),
  withdraw: async ({ tx, env }) => {
    await tx.run(
      sql`UPDATE permissions_quota_ledger SET deleted_at = ${(env.serverNow ?? env.now)().toISOString()} WHERE owner_id = ${env.actorId}`
    );
  },
  erase: async ({ tx, env }) => {
    await tx.run(
      sql`UPDATE permissions_quota_ledger SET owner_id = ${null}, idempotency_key = ${null}, amount = ${null}, consumed_at = ${null} WHERE owner_id = ${env.actorId}`
    );
  },
};
