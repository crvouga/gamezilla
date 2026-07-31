import { SpaceCol, SPACES_TABLE } from '@libs/db/shared/space-tables';
import { sqlMap } from '@pkgs/sql';
import { useWatchQuery } from '@pkgs/sync-engine/client/sync-engine-context';

type SpaceIdRow = { readonly id: string };

/**
 * Ids of every live (non-ended) space, ordered newest-first.
 */
export function useLiveSpaceIds(): {
  readonly spaceIds: readonly string[];
  readonly isLoading: boolean;
} {
  const { rows, isLoading } = useWatchQuery<SpaceIdRow>(
    sqlMap({
      select: [SpaceCol.id],
      from: SPACES_TABLE.tableName,
      where: ['is-null', SpaceCol.endedAt],
      orderBy: [[SpaceCol.createdAt, 'desc']],
    })
  );
  return { spaceIds: rows.map((r) => r.id), isLoading };
}
