import { sql } from '@pkgs/sql';
import { useQuery } from '@pkgs/sync-engine/client';

/** Host username for a space row, when synced locally. */
export function useSpaceHostUsername(spaceId: string): string | null {
  const enabled = spaceId.length > 0;
  const { rows } = useQuery(sql<{ readonly username: string | null }>`
    SELECT p.username
    FROM spaces AS s
    INNER JOIN profile AS p
      ON p.id = COALESCE(s.host_account_id, s.host_member_id)
    WHERE s.id = ${spaceId}
    LIMIT 1
  `);
  if (!enabled) {
    return null;
  }
  const username = rows[0]?.username ?? null;
  return username !== null && username.length > 0 ? username : null;
}
