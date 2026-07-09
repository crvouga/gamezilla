import { SpaceCol, SPACES_TABLE } from '@libs/spaces/shared/sync-tables';
import { useWatchQuery } from '@pkgs/sync-engine/client/sync-engine-context';

type SpaceIdRow = { readonly id: string };

/**
 * Ids of every live (non-ended) space, ordered newest-first.
 */
export function useLiveSpaceIds(): string[] {
  const { rows } = useWatchQuery<SpaceIdRow>(
    `SELECT ${SpaceCol.id} AS id FROM ${SPACES_TABLE.tableName}
     WHERE ${SpaceCol.endedAt} IS NULL
     ORDER BY ${SpaceCol.createdAt} DESC`
  );
  return rows.map((r) => r.id);
}
