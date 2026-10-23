import { useMyId } from '@libs/auth-client-ts/use-current-user';
import { puzzleStores } from '@libs/game-puzzle-shared-ts/puzzle-tables';
import sql, { raw } from '@pkgs/sql-root-shared-ts/sql';
import { createQuery } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { type Accessor, createMemo } from 'solid-js';

/** A restored board must retain its result until the account has recorded it. */
export function usePuzzleResultRecorded(puzzleId: Accessor<string | null>) {
  const myId = useMyId();
  const query = createQuery(
    () => sql<{ puzzle_id: string }>`
      SELECT puzzle_id FROM ${raw(puzzleStores.ratingEvents)}
      WHERE owner_id = ${myId()} AND puzzle_id = ${puzzleId()}
        AND deleted_at IS NULL
      LIMIT 1
    `
  );
  return {
    ready: createMemo(() => !query.isLoading()),
    recorded: createMemo(() => query.rows().length > 0),
  };
}
