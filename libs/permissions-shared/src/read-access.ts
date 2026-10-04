import { ClientConfigKey } from '@libs/app-config-shared/client-config-keys';
import type { ClientConfigDbRow } from '@libs/app-config-shared/parse-client-config';
import { parseClientConfigRows } from '@libs/app-config-shared/parse-client-config';
import type { Facts } from '@pkgs/permissions-shared/facts';
import type { PermissionPolicy } from '@pkgs/permissions-shared/policy';
import sql from '@pkgs/sql-shared/sql';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';

import { governingSubscription, resolveAccessFacts } from './access-facts';
import type { SubscriptionRow } from './access-facts';
import { parsePermissionPolicy } from './parse-permission-policy';
import type { AppLimit, AppPolicyKey } from './permission-catalog';

/** Read-only slice of a transaction or client (mutation `tx`, server db). */
export type AccessReader = Pick<SqlClient, 'query'>;

/** Whose facts: the mutation / request actor, as the session resolved it. */
export type AccessIdentity = {
  readonly actorId: string;
  readonly accountId: string | null;
  readonly isAnon: boolean;
};

const ACCESS_CONFIG_KEYS = [
  ClientConfigKey.permissionPolicy,
  ClientConfigKey.billingEnabled,
  ClientConfigKey.billingGracePeriodMs,
];

async function readAccessConfig(
  db: AccessReader
): Promise<readonly ClientConfigDbRow[]> {
  return db.query<ClientConfigDbRow>(sql<ClientConfigDbRow>`
    SELECT id, value, deleted_at FROM client_config
    WHERE id IN (${ACCESS_CONFIG_KEYS[0]}, ${ACCESS_CONFIG_KEYS[1]}, ${ACCESS_CONFIG_KEYS[2]})
      AND deleted_at IS NULL
  `);
}

function policyOf(
  rows: readonly ClientConfigDbRow[]
): PermissionPolicy<AppPolicyKey, AppLimit> {
  const row = rows.find((r) => r.id === ClientConfigKey.permissionPolicy);
  return parsePermissionPolicy(row === undefined ? null : row.value);
}

/**
 * The synced `permission_policy` row (current version plus retained history);
 * the shipped policy when absent or malformed. Same read on client and server.
 */
export async function readPermissionPolicy(
  db: AccessReader
): Promise<PermissionPolicy<AppPolicyKey, AppLimit>> {
  return policyOf(await readAccessConfig(db));
}

/** Policy and facts for `identity`, from one config read. */
export type AccessSnapshot = {
  readonly policy: PermissionPolicy<AppPolicyKey, AppLimit>;
  readonly facts: Facts;
};

/**
 * Policy plus facts for `identity`: sign-in state from the session identity
 * (signed in = not anonymous and bound to an account — the rule the server
 * always used), membership, grace and the billing switch from synced rows
 * (`billing_subscriptions`, `client_config`) so the optimistic local decision
 * and the server replay read the same inputs.
 */
export async function readAccess(
  db: AccessReader,
  identity: AccessIdentity,
  nowMs: number
): Promise<AccessSnapshot> {
  const signedIn = !identity.isAnon && identity.accountId !== null;
  const [configRows, subscriptions] = await Promise.all([
    readAccessConfig(db),
    signedIn
      ? db.query<SubscriptionRow>(sql<SubscriptionRow>`
          SELECT status, current_period_end, cancel_at_period_end
          FROM billing_subscriptions
          WHERE account_id = ${identity.accountId}
            AND deleted_at IS NULL
          ORDER BY updated_at DESC
          LIMIT 50
        `)
      : Promise.resolve([]),
  ]);
  const config = parseClientConfigRows(configRows);
  return {
    policy: policyOf(configRows),
    facts: resolveAccessFacts({
      signedIn,
      subscription: governingSubscription(subscriptions),
      nowMs,
      graceMs: config.billing_grace_period_ms,
      // Judged as the server judges: the rows are as confirmed as they get.
      confirmedAtMs: nowMs,
      billingEnabled: config.billing_enabled,
    }),
  };
}
