import { EXTERNAL_ACCOUNT_PROVIDER_STRIPE } from '@libs/auth/shared/external-account-providers';
import {
  EXTERNAL_ACCOUNTS_TABLE,
  ExternalAccountCol,
} from '@libs/auth/shared/external-accounts-tables';
import type { SqlClient } from '@pkgs/sql-client/interface';

/** Resolves application user id for a Stripe customer id. */
export async function resolveAccountIdByStripeCustomerId(
  sql: SqlClient,
  stripeCustomerId: string
): Promise<string | null> {
  const rows = await sql.query<{ readonly user_id: string }>(
    `SELECT ${ExternalAccountCol.userId} AS user_id
     FROM ${EXTERNAL_ACCOUNTS_TABLE}
     WHERE ${ExternalAccountCol.provider} = ?
       AND ${ExternalAccountCol.externalId} = ?
     LIMIT 1`,
    [EXTERNAL_ACCOUNT_PROVIDER_STRIPE, stripeCustomerId]
  );
  return rows[0]?.user_id ?? null;
}
