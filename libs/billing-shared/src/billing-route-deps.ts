/**
 * Dependency contract shared by the billing HTTP routes. Each route class
 * lives in its own use case; this is the composition seam the app satisfies.
 */
import type { MembershipProviders } from '@pkgs/billing-root-shared/providers';
import type { Clock } from '@pkgs/clock-shared/types';
import type { Logger } from '@pkgs/logger-shared/logger';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import type { CreateId } from '@pkgs/uuid-shared/create-id';
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
  /** Every configured provider, or `null` when billing is off. */
  readonly billing: MembershipProviders | null;
  readonly requireAuth: BillingRequireAuth;
  readonly createId: CreateId;
  readonly clock: Clock;
  readonly log: Logger;
  readonly notifyUser: BillingNotify;
};

export function billingNotConfigured(c: Context): Response {
  return c.json({ error: 'Billing is not configured' }, 503);
}

/** Which provider call failed, for the record of an outage. */
export type BillingProviderOperation = 'checkout' | 'portal';

/**
 * The provider could not be reached (or failed) while the person waited: a
 * plain 503 the app explains as "try again in a moment", recorded with the
 * provider and the kind of failure only — never who asked.
 */
export function billingProviderUnavailable(
  c: Context,
  log: Logger,
  failure: {
    readonly provider: string;
    readonly operation: BillingProviderOperation;
    readonly error: unknown;
  }
): Response {
  log.error('billing provider unavailable', {
    provider: failure.provider,
    operation: failure.operation,
    errorType:
      failure.error instanceof Error
        ? failure.error.name
        : typeof failure.error,
  });
  return c.json(
    { error: 'Billing provider unavailable', code: 'provider_unavailable' },
    503
  );
}
