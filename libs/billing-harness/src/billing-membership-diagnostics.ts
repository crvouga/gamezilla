import {
  LAST_LOCAL_ACCOUNT_ID_KEY,
  SESSION_EXPIRES_AT_KEY,
} from '@libs/auth-shared/auth-storage-keys';
import type { ProductHarness } from '@libs/harness/harness';
import { accountIdOf, actorLocalSql } from '@libs/harness/identity';
import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import sql from '@pkgs/sql-root-shared/sql';
import { subscriptionsEverywhere } from './billing-provider-driver';

async function membershipRows(db: SqlTx, accountId: string) {
  return db.query(sql<Record<string, unknown>>`
    SELECT id, status, current_period_end, updated_at, deleted_at
    FROM billing_subscriptions WHERE account_id = ${accountId}
  `);
}

/** Only lifecycle facts for a failing automated check, without payment details. */
export async function billingMembershipDiagnostics(
  s: ProductHarness,
  actor: string
): Promise<string> {
  const account = await accountIdOf(s, actor);
  if (account === null) return 'No account';
  const local = actorLocalSql(s, actor);
  const env = await s.harness.client(actor);
  const providers = await subscriptionsEverywhere(s, account);
  return JSON.stringify({
    now: s.session.ports.clock.now(),
    identity: {
      account,
      localAccount: env.secureStorage.getValue(LAST_LOCAL_ACCOUNT_ID_KEY),
      expiresAt: env.secureStorage.getValue(SESSION_EXPIRES_AT_KEY),
    },
    scopes:
      local === null
        ? null
        : await local.query(sql<Record<string, unknown>>`
      SELECT scope_hash, last_checkpoint, last_active_at, deleted_at
      FROM sync_engine_scope_meta
    `),
    providers: providers.map(({ provider, subscriptions }) => ({
      provider: provider.id,
      now: provider.now(),
      subscriptions: subscriptions.map((item) => ({
        id: item.id,
        status: item.status,
        created: item.created,
        periodEnd: item.items.data[0]?.current_period_end,
      })),
    })),
    shared: await membershipRows(s.harness.serverSql.sqlClient, account),
    local: local === null ? null : await membershipRows(local, account),
  });
}
