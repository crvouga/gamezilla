import { LAST_LOCAL_ACCOUNT_ID_KEY } from '@libs/auth-shared/auth-storage-keys';
import type { ProductHarness } from '@libs/harness/harness';
import sql from '@pkgs/sql-root-shared/sql';

/** Which people still host an open space, including when away. */
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
    if (!s.actors.has(person)) continue;
    const env = await s.harness.client(person);
    const member = env.secureStorage.getValue(LAST_LOCAL_ACCOUNT_ID_KEY);
    if (typeof member === 'string' && hosts.has(member)) names.add(person);
  }
  return names;
}
