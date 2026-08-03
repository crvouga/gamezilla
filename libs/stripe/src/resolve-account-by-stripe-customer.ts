import { EXTERNAL_ACCOUNT_PROVIDER_STRIPE } from '@libs/auth/shared/external-account-providers';
import { sql } from '@pkgs/sql';

import type { SqlClient } from '@pkgs/sql-client/interface';

/** Resolves application user id for a Stripe customer id. */
export async function resolveAccountIdByStripeCustomerId(
  db: SqlClient,
  stripeCustomerId: string
): Promise<string | null> {
  const rows = await db.query(sql<{ readonly user_id: string }>`
    SELECT user_id
    FROM external_accounts
    WHERE provider = ${EXTERNAL_ACCOUNT_PROVIDER_STRIPE}
      AND external_id = ${stripeCustomerId}
    LIMIT 1
  `);
  return rows[0]?.user_id ?? null;
}
