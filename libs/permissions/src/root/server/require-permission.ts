import type { AppAuth } from '@libs/auth/public/auth-context';
import { UnauthorizedError } from '@libs/auth/public/unauthorized-error';
import { DEFAULT_BILLING_GRACE_PERIOD_MS } from '@libs/client-config/public/client-config-defaults';
import { ClientConfigKey } from '@libs/client-config/public/client-config-keys';
import {
  can,
  createSubject,
  type PermissionPolicy,
  type Subject,
} from '@pkgs/permissions';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { parsePermissionPolicy } from '../../public/parse-permission-policy';
import type { AppLimit, AppPermission } from '../../public/permission-catalog';
import {
  readSubscriptionSnapshot,
  resolvePlanRole,
  type SubscriptionRow,
} from '../../public/plan';

type ConfigRow = { readonly id: string; readonly value: unknown };

function coerceJsonValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function readLiveConfigRows(
  db: SqlClient
): Promise<ReadonlyMap<string, unknown>> {
  const rows = await db.query<ConfigRow>(
    sql<ConfigRow>`SELECT id, value FROM client_config WHERE deleted_at IS NULL`
  );
  const out = new Map<string, unknown>();
  for (const row of rows) out.set(row.id, row.value);
  return out;
}

function readGraceMs(rows: ReadonlyMap<string, unknown>): number {
  const value = coerceJsonValue(rows.get(ClientConfigKey.billingGracePeriodMs));
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : DEFAULT_BILLING_GRACE_PERIOD_MS;
}

async function readSubscriptionRow(
  db: SqlClient,
  accountId: string
): Promise<SubscriptionRow | undefined> {
  const rows = await db.query<SubscriptionRow>(sql<SubscriptionRow>`
    SELECT status, current_period_end, cancel_at_period_end
    FROM billing_subscriptions
    WHERE account_id = ${accountId} AND deleted_at IS NULL
    ORDER BY updated_at DESC
    LIMIT 1
  `);
  return rows[0];
}

/** Live `permission_policy` row parsed to the app policy (default when absent). */
export async function resolveServerPermissionPolicy(
  db: SqlClient
): Promise<PermissionPolicy<AppPermission, AppLimit>> {
  const rows = await readLiveConfigRows(db);
  return parsePermissionPolicy(rows.get(ClientConfigKey.permissionPolicy));
}

/**
 * Plan role for the request actor: no auth context or an anon device is a
 * guest; otherwise it comes from the subscription row plus the grace period.
 */
export async function resolveServerPermissionSubject(args: {
  readonly db: SqlClient;
  readonly auth: AppAuth | null;
  readonly nowMs: number;
}): Promise<Subject> {
  const rows = await readLiveConfigRows(args.db);
  const accountId = args.auth?.accountId ?? null;
  const signedIn =
    args.auth !== null && !args.auth.isAnon && accountId !== null;
  const subscription =
    signedIn && accountId !== null
      ? await readSubscriptionRow(args.db, accountId)
      : undefined;
  return createSubject([
    resolvePlanRole({
      signedIn,
      subscription: readSubscriptionSnapshot(subscription),
      nowMs: args.nowMs,
      graceMs: readGraceMs(rows),
    }),
  ]);
}

/**
 * Throws `UnauthorizedError` (mapped to 401 by the API error handler) when the
 * request actor lacks `permission`.
 */
export async function requirePermission(args: {
  readonly db: SqlClient;
  readonly auth: AppAuth | null;
  readonly permission: AppPermission;
  readonly nowMs: number;
}): Promise<void> {
  const [policy, subject] = await Promise.all([
    resolveServerPermissionPolicy(args.db),
    resolveServerPermissionSubject({
      db: args.db,
      auth: args.auth,
      nowMs: args.nowMs,
    }),
  ]);
  if (!can(policy, subject, args.permission).allowed) {
    throw new UnauthorizedError(`Permission denied: ${args.permission}`);
  }
}
