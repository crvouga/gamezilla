import { SpaceCol, SPACES_TABLE } from '@libs/db/shared/space-tables';
import { raw, sql } from '@pkgs/sql';
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
    sql`SELECT ${raw(SpaceCol.id)} AS id
     FROM ${raw(SPACES_TABLE.tableName)}
     WHERE ${raw(SpaceCol.endedAt)} IS NULL
     ORDER BY ${raw(SpaceCol.createdAt)} DESC`
  );
  return { spaceIds: rows.map((r) => r.id), isLoading };
}
