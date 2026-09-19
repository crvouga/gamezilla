/**
 * Dependency contract shared by the billing HTTP routes. Each route class
 * lives in its own use case; this is the composition seam the app satisfies.
 */
import type { MembershipBilling } from '@pkgs/billing';
import type { Clock } from '@pkgs/clock';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid/create-id';
import type { Context } from 'hono';

export type BillingAuthContext = {
  readonly accountId: string;
  readonly deviceId: string;
};

export type BillingRequireAuth = (
  sql: SqlClient,
  request: Request
) => Promise<BillingAuthContext>;

/** Best-effort user-topic push after a DOMAIN write (app-injected). */
export type BillingNotify = (
  accountId: string,
  label: string,
  tables: readonly string[]
) => Promise<void>;

export type BillingRouteDeps = {
  readonly getSqlClient: () => SqlClient;
  readonly billing: MembershipBilling | null;
  readonly requireAuth: BillingRequireAuth;
  readonly createId: CreateId;
  readonly clock: Clock;
  readonly notifyUser: BillingNotify;
};

export function billingNotConfigured(c: Context): Response {
  return c.json({ error: 'Billing is not configured' }, 503);
}
