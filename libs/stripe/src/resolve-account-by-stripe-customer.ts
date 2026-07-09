import { AccountCol, ACCOUNTS_TABLE } from '@libs/auth/shared/auth-tables';
import type { SqlClient } from '@pkgs/sql-client/interface';

/** Resolves account id for a Stripe customer id. */
export async function resolveAccountIdByStripeCustomerId(
  sql: SqlClient,
  stripeCustomerId: string
): Promise<string | null> {
  const rows = await sql.query<{ readonly id: string }>(
    `SELECT ${AccountCol.id} AS id FROM ${ACCOUNTS_TABLE.tableName}
     WHERE ${AccountCol.stripeCustomerId} = ? LIMIT 1`,
    [stripeCustomerId]
  );
  return rows[0]?.id ?? null;
}
