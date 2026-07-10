import { SpaceCol, SPACES_TABLE } from '@libs/db/shared/space-tables';
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
    `SELECT ${SpaceCol.id} AS id FROM ${SPACES_TABLE.tableName}
     WHERE ${SpaceCol.endedAt} IS NULL
     ORDER BY ${SpaceCol.createdAt} DESC`
  );
  return { spaceIds: rows.map((r) => r.id), isLoading };
}
