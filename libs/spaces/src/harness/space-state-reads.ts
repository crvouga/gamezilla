import type { ProductHarness } from '@libs/harness/system/harness';
import { accountIdOf } from '@libs/harness/system/identity';
import { sql } from '@pkgs/sql';

/** Which signed-in people still host an open space, including when away. */
export async function openSpaceHosts(
  s: ProductHarness,
  people: readonly string[]
): Promise<Set<string>> {
  const rows = await s.harness.serverSql.sqlClient.query(sql<{
    readonly host: string;
  }>`
    SELECT COALESCE(host_account_id, host_member_id) AS host
    FROM spaces WHERE ended_at IS NULL AND deleted_at IS NULL
  `);
  const hosts = new Set(rows.map((row) => row.host));
  const names = new Set<string>();
  for (const person of people) {
    const account = await accountIdOf(s, person);
    if (account !== null && hosts.has(account)) names.add(person);
  }
  return names;
}
