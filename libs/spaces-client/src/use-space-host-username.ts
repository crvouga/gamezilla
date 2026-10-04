import sql from '@pkgs/sql-root-shared/sql';
import { createQuery } from '@pkgs/sync-engine-client/sync-engine-context';
import { type Accessor, createMemo } from 'solid-js';

/** Host username for a space row, when synced locally. */
export function useSpaceHostUsername(
  spaceId: string | Accessor<string>
): Accessor<string | null> {
  const resolveId = (): string =>
    typeof spaceId === 'string' ? spaceId : spaceId();
  const enabled = createMemo(() => resolveId().length > 0);
  const query = createQuery(
    () =>
      sql<{ readonly username: string | null }>`
      SELECT p.username
      FROM spaces AS s
      INNER JOIN profile AS p
        ON p.id = COALESCE(s.host_account_id, s.host_member_id)
      WHERE s.id = ${resolveId()}
      LIMIT 1
    `
  );
  return createMemo(() => {
    if (!enabled()) return null;
    const username = query.rows()[0]?.username ?? null;
    return username !== null && username.length > 0 ? username : null;
  });
}
