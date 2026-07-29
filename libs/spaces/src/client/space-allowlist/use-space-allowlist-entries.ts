import {
  SPACE_ALLOWLIST_TABLE,
  SpaceAllowlistCol,
} from '@libs/db/shared/space-tables';
import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import { col, honey } from '@pkgs/sql';
import { useWatchQuery } from '@pkgs/sync-engine/client/sync-engine-context';
import { useMemo } from 'react';

export type SpaceAllowlistEntry = {
  readonly userId: string;
  readonly username: string;
  readonly avatarConfig: string | null;
};

type AllowlistRow = {
  readonly user_id: string;
  readonly username: string | null;
  readonly avatar_config: string | null;
};

export function useSpaceAllowlistEntries(spaceId: string): {
  readonly entries: readonly SpaceAllowlistEntry[];
  readonly isLoading: boolean;
} {
  const enabled = spaceId.length > 0;
  const query = useMemo(
    () =>
      honey({
        select: [
          [`a.${SpaceAllowlistCol.userId}`, 'user_id'],
          [`p.${ProfileCol.username}`, 'username'],
          [`p.${ProfileCol.avatarConfig}`, 'avatar_config'],
        ],
        from: [SPACE_ALLOWLIST_TABLE.tableName, 'a'],
        join: [
          [PROFILES_TABLE.tableName, 'p'],
          ['=', `p.${ProfileCol.id}`, col(`a.${SpaceAllowlistCol.userId}`)],
        ],
        where: enabled
          ? ['=', `a.${SpaceAllowlistCol.spaceId}`, spaceId]
          : ['=', 1, 0],
        orderBy: [
          [`p.${ProfileCol.username}`, 'asc', { collate: 'NOCASE' }],
        ],
      }),
    [enabled, spaceId]
  );
  const { rows, isLoading } = useWatchQuery<AllowlistRow>(query);
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
