import { DEFAULT_BILLING_GRACE_PERIOD_MS } from '@libs/client-config/public/client-config-defaults';
import { ClientConfigKey } from '@libs/client-config/public/client-config-keys';
import type { Facts, PermissionPolicy } from '@pkgs/permissions';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { parsePermissionPolicy } from './parse-permission-policy';
import type { AppLimit, AppPolicyKey } from './permission-catalog';
import {
  readSubscriptionSnapshot,
  resolveAccessFacts,
  type SubscriptionRow,
} from './plan';

/** Read-only slice of a transaction or client (mutation `tx`, server db). */
export type AccessReader = Pick<SqlClient, 'query'>;

/** Whose facts: the mutation / request actor, as the session resolved it. */
export type AccessIdentity = {
  readonly actorId: string;
  readonly accountId: string | null;
  readonly isAnon: boolean;
};

type ConfigRow = { readonly value: unknown };
function coerceJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function readConfigValue(
  db: AccessReader,
  key: string
): Promise<unknown> {
  const rows = await db.query<ConfigRow>(sql<ConfigRow>`
    SELECT value FROM client_config WHERE id = ${key} AND deleted_at IS NULL
  `);
  return rows[0] === undefined ? null : rows[0].value;
}

/**
 * The synced `permission_policy` row (current version plus retained history);
 * the shipped policy when absent or malformed. Same read on client and server.
 */
export async function readPermissionPolicy(
  db: AccessReader
): Promise<PermissionPolicy<AppPolicyKey, AppLimit>> {
  return parsePermissionPolicy(
    await readConfigValue(db, ClientConfigKey.permissionPolicy)
  );
}

async function readGraceMs(db: AccessReader): Promise<number> {
  const value = coerceJson(
    await readConfigValue(db, ClientConfigKey.billingGracePeriodMs)
  );
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : DEFAULT_BILLING_GRACE_PERIOD_MS;
}

/**
 * Facts for `identity`: sign-in state from the session identity (signed in =
 * not anonymous and bound to an account — the rule the server always used),
 * membership and grace from synced rows (`billing_subscriptions`,
 * `client_config`) so the optimistic local decision and the server replay
 * read the same inputs.
 */
export async function readAccessFacts(
  db: AccessReader,
  identity: AccessIdentity,
  nowMs: number
): Promise<Facts> {
  const signedIn = !identity.isAnon && identity.accountId !== null;
  const subscriptions = signedIn
    ? await db.query<SubscriptionRow>(sql<SubscriptionRow>`
        SELECT status, current_period_end, cancel_at_period_end
        FROM billing_subscriptions
        WHERE account_id = ${identity.accountId}
          AND deleted_at IS NULL
        ORDER BY updated_at DESC
        LIMIT 1
      `)
    : [];
  return resolveAccessFacts({
    signedIn,
    subscription: readSubscriptionSnapshot(subscriptions[0]),
    nowMs,
    graceMs: await readGraceMs(db),
  });
}
