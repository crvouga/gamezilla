import { useMyId } from '@libs/auth-client-ts/use-current-user';
import type { AttemptLibrary } from '@libs/game-puzzle-shared-ts/attempt-library';
import type {
  AttemptPosition,
  ContentAttempt,
  ContentCompletion,
} from '@libs/game-puzzle-shared-ts/attempt-types';
import sql from '@pkgs/sql-root-shared-ts/sql';
import {
  createQuery,
  useSyncEngine,
} from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { type Accessor, createMemo } from 'solid-js';

export function useContentAttempts(gameId: Accessor<string>) {
  const myId = useMyId();
  const engine = useSyncEngine();
  const attempts = createQuery(
    () =>
      sql<ContentAttempt>`SELECT * FROM puzzle_content_attempts WHERE game_id = ${gameId()} AND owner_id = ${myId()} AND deleted_at IS NULL ORDER BY updated_at DESC, id`
  );
  const positions = createQuery(
    () =>
      sql<AttemptPosition>`SELECT p.* FROM puzzle_content_positions p INNER JOIN puzzle_content_attempts a ON a.id = p.attempt_id WHERE a.game_id = ${gameId()} AND p.owner_id = ${myId()} AND p.deleted_at IS NULL`
  );
  const completions = createQuery(
    () =>
      sql<ContentCompletion>`SELECT c.* FROM puzzle_content_completions c INNER JOIN puzzle_content_attempts a ON a.id = c.attempt_id WHERE a.game_id = ${gameId()} AND c.owner_id = ${myId()} AND c.deleted_at IS NULL`
  );
  const library = createMemo<AttemptLibrary>(() =>
    engine.paintReady()
      ? {
          attempts: attempts.rows(),
          positions: positions.rows(),
          completions: completions.rows(),
        }
      : { attempts: [], positions: [], completions: [] }
  );
  const isLoading = createMemo(
    () =>
      !engine.paintReady() ||
      attempts.isLoading() ||
      positions.isLoading() ||
      completions.isLoading()
  );
  return { library, isLoading };
}
