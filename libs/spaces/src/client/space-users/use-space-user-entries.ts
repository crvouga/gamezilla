import { sql } from '@pkgs/sql';

import { useWatchQuery } from '@pkgs/sync-engine/client/sync-engine-context';
import { useMemo } from 'react';

export type SpaceUserEntry = {
  readonly userId: string;
  readonly username: string;
  readonly avatarConfig: string | null;
};

type SpaceUserRow = {
  readonly user_id: string;
  readonly username: string | null;
  readonly avatar_config: string | null;
};

export function useSpaceUserEntries(spaceId: string): {
  readonly entries: readonly SpaceUserEntry[];
  readonly isLoading: boolean;
} {
  const query = useMemo(
    () => sql<SpaceUserRow>`
      SELECT a.user_id, p.username, p.avatar_config
      FROM space_users AS a
      INNER JOIN profiles AS p ON p.id = a.user_id
      WHERE a.space_id = ${spaceId}
      ORDER BY p.username COLLATE NOCASE ASC
    `,
    [spaceId]
  );
  const { rows, isLoading } = useWatchQuery(query);
  const entries = useMemo(
    () =>
      rows.map((row) => ({
        userId: row.user_id,
        username: row.username ?? '',
        avatarConfig: row.avatar_config,
      })),
    [rows]
  );
  return { entries, isLoading };
}
