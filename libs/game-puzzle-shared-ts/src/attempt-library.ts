import sql from '@pkgs/sql-root-shared-ts/sql';
import type { MutationDb } from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { PuzzleContent } from '@pkgs/turn-game-shared-ts/puzzle-content';
import { currentAttemptState } from './attempt-history';
import {
  type AttemptPosition,
  type ContentAttempt,
  type ContentCompletion,
  decodeAttemptHistory,
} from './attempt-types';

export type AttemptLibrary = {
  readonly attempts: readonly ContentAttempt[];
  readonly positions: readonly AttemptPosition[];
  readonly completions: readonly ContentCompletion[];
};

export async function readAttemptLibrary(
  db: MutationDb
): Promise<AttemptLibrary> {
  return {
    attempts: await db.query(
      sql<ContentAttempt>`SELECT * FROM puzzle_content_attempts WHERE deleted_at IS NULL`
    ),
    positions: await db.query(
      sql<AttemptPosition>`SELECT * FROM puzzle_content_positions WHERE deleted_at IS NULL`
    ),
    completions: await db.query(
      sql<ContentCompletion>`SELECT * FROM puzzle_content_completions WHERE deleted_at IS NULL`
    ),
  };
}

export function attemptContinuations(
  library: AttemptLibrary,
  attemptId: string
): readonly AttemptPosition[] {
  const positions = library.positions.filter(
    (position) => position.attempt_id === attemptId
  );
  const parents = new Set(positions.map((position) => position.parent_id));
  return positions.filter((position) => !parents.has(position.id));
}

export function projectAttemptPosition(args: {
  readonly position: AttemptPosition;
  readonly definition: string;
  readonly game: PuzzleContent;
}) {
  const history = decodeAttemptHistory(args.position.history);
  if (history === null) return null;
  const state = currentAttemptState(history);
  const validation = args.game.rules.validateState(args.definition, state);
  if (!validation.valid) return null;
  return {
    state,
    complete: args.game.rules.complete(args.definition, state),
    canUndo: args.game.history === 'snapshots' && history.cursor > 0,
    canRedo:
      args.game.history === 'snapshots' &&
      history.cursor < history.entries.length - 1,
  };
}
