import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import { SPACE_USERS_TABLE, SpaceUserCol } from '@libs/db/shared/space-tables';
import { col, sqlMap } from '@pkgs/sql-map';

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
  const enabled = spaceId.length > 0;
  const query = useMemo(
    () =>
      sqlMap({
        select: [
          [`a.${SpaceUserCol.userId}`, 'user_id'],
          [`p.${ProfileCol.username}`, 'username'],
          [`p.${ProfileCol.avatarConfig}`, 'avatar_config'],
        ],
        from: [SPACE_USERS_TABLE.tableName, 'a'],
        join: [
          [PROFILES_TABLE.tableName, 'p'],
          ['=', `p.${ProfileCol.id}`, col(`a.${SpaceUserCol.userId}`)],
        ],
        where: enabled
          ? ['=', `a.${SpaceUserCol.spaceId}`, spaceId]
          : ['=', 1, 0],
        orderBy: [[`p.${ProfileCol.username}`, 'asc', { collate: 'NOCASE' }]],
      }),
    [enabled, spaceId]
  );
  const { rows, isLoading } = useWatchQuery<SpaceUserRow>(query);
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
