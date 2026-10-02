import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

/** Anonymous bootstrap cannot claim a signup handle; accounts may choose one. */
export async function resolveReplayUsername(
  tx: Pick<SqlClient, 'query'>,
  userId: string,
  passed: string | undefined
): Promise<string | undefined> {
  const anon = await tx.query<{
    is_anon: boolean | number | string | null;
  }>(sql`
    SELECT is_anon
    FROM auth_users
    WHERE id = ${userId}
    LIMIT 1
  `);
  const flag = anon[0]?.is_anon;
  if (flag === undefined || flag === null) return undefined;
  if (flag === true || flag === 1 || flag === '1' || flag === 't') {
    return undefined;
  }
  return passed;
}
