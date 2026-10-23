import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';

/** Provisioned addresses are classified before their first normal sign-in.
 * Tombstones preserve this provenance; pausing or deleting a bot is not a
 * transition into genuine customer activity. Addresses never leave SQL. */
export async function isSyntheticPopulationAddress(
  tx: SqlTx,
  email: string | null
): Promise<boolean> {
  if (email === null) return false;
  const rows = await tx.query(sql<{ id: string }>`
    SELECT id FROM population_users WHERE email = ${email} LIMIT 1
  `);
  return rows.length > 0;
}

/** Reporting includes tombstones so deleting a bot cannot reclassify history. */
export async function syntheticPopulationAccountIds(
  tx: SqlTx
): Promise<readonly string[]> {
  const rows = await tx.query(sql<{ account_id: string }>`
    SELECT account_id FROM population_users WHERE account_id IS NOT NULL
  `);
  return rows.map((row) => row.account_id);
}
