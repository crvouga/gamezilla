import { useMyId } from '@libs/auth-client/use-current-user';
import sql from '@pkgs/sql-root-shared/sql';
import { createQuery } from '@pkgs/sync-engine-client/sync-engine-context';
import { type Accessor, createMemo } from 'solid-js';

/** A restored board must retain its result until the account has recorded it. */
export function usePuzzleResultRecorded(puzzleId: Accessor<string | null>) {
  const myId = useMyId();
  const query = createQuery(
    () => sql<{ puzzle_id: string }>`
      SELECT puzzle_id FROM chess_puzzle_rating_events
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
