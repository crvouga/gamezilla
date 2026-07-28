import { EXTERNAL_ACCOUNT_PROVIDER_STRIPE } from '@libs/auth/shared/external-account-providers';
import {
  EXTERNAL_ACCOUNTS_TABLE,
  ExternalAccountCol,
} from '@libs/db/shared/external-accounts-tables';
import { raw, sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

/** Resolves application user id for a Stripe customer id. */
export async function resolveAccountIdByStripeCustomerId(
  db: SqlClient,
  stripeCustomerId: string
): Promise<string | null> {
  const rows = await db.query<{ readonly user_id: string }>(sql`
    SELECT ${raw(ExternalAccountCol.userId)} AS user_id
     FROM ${raw(EXTERNAL_ACCOUNTS_TABLE)}
     WHERE ${raw(ExternalAccountCol.provider)} = ${EXTERNAL_ACCOUNT_PROVIDER_STRIPE}
       AND ${raw(ExternalAccountCol.externalId)} = ${stripeCustomerId}
     LIMIT 1
  `);
  return rows[0]?.user_id ?? null;
}
