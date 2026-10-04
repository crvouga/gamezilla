import { useMyId } from '@libs/auth-client/use-current-user';
import type { ChessPuzzleInteractionRow } from '@libs/chess-puzzle-shared/chess-puzzle-interaction-entities';
import sql from '@pkgs/sql-root-shared/sql';
import {
  createQuery,
  useSyncEngineInstance,
} from '@pkgs/sync-engine-client/sync-engine-context';
import {
  type Accessor,
  createEffect,
  createMemo,
  mergeProps,
  onCleanup,
  untrack,
} from 'solid-js';

function readStringArray(raw: unknown): readonly string[] {
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((x): x is string => typeof x === 'string');
      }
    } catch {
      return [];
    }
  }
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === 'string');
  }
  return [];
}

function readNullableBoolean(raw: unknown): boolean | null {
  if (raw === true || raw === false) return raw;
  if (raw === 1) return true;
  if (raw === 0) return false;
  return null;
}

type InteractionSqlRow = {
  readonly puzzle_id: string;
  readonly kind: string;
  readonly solve_idx: number;
  readonly uci: string | null;
  readonly correct: unknown;
  readonly puzzle_rating: number;
  readonly at: string;
};

function interactionRowFromSql(
  row: InteractionSqlRow
): ChessPuzzleInteractionRow {
  return {
    puzzleId: row.puzzle_id,
    kind: row.kind as ChessPuzzleInteractionRow['kind'],
    solveIdx: row.solve_idx,
    uci: row.uci,
    correct: readNullableBoolean(row.correct),
    puzzleRating: row.puzzle_rating,
    at: row.at,
  };
}

type PuzzleEntityRow = {
  readonly fen: string | null;
  readonly moves: string | null;
  readonly rating: number | null;
  readonly rating_deviation: number | null;
  readonly themes: unknown;
};

/** Match sync hydrate limit so Elo folds see full attempt history. */
const INTERACTION_HISTORY_LIMIT = 5000;

/** Registered query name for a single puzzle row (watchers outside the band). */
const PUZZLE_BY_ID_QUERY_NAME = 'chessPuzzleById';

export type PuzzleEntityView = {
  fen: string;
  movesStr: string;
  rating: number;
  ratingDeviation: number;
  themes: readonly string[];
};

function puzzleEntityView(
  row: Accessor<PuzzleEntityRow | null>
): PuzzleEntityView {
  return {
    get fen() {
      return row()?.fen ?? '';
    },
    get movesStr() {
      return row()?.moves ?? '';
    },
    get rating() {
      return row()?.rating ?? 0;
    },
    get ratingDeviation() {
      return row()?.rating_deviation ?? 0;
    },
    get themes() {
      return readStringArray(row()?.themes);
    },
  };
}

/**
 * A watcher whose rating band does not contain the host's puzzle has no local
 * row; hydrate that one puzzle by id so the board can render.
 *
 * One subscription per id: `row` is read untracked on purpose. The hydrate
 * this effect starts writes the row locally, which is a table change, which
 * re-runs the caller's query. Tracking `row` here would then unsubscribe and
 * resubscribe on that change — and for a row the query can never return (a
 * retired puzzle is a tombstone, so `deleted_at IS NULL` stays empty) that
 * loop never ends and the whole client wedges.
 */
function useHydratePuzzleById(
  puzzleId: Accessor<string>,
  row: Accessor<PuzzleEntityRow | null>
): void {
  const sync = useSyncEngineInstance();
  createEffect(() => {
    const id = puzzleId();
    if (id.length === 0 || untrack(row) !== null) return;
    const handle = sync.subscribeQueries([
      { name: PUZZLE_BY_ID_QUERY_NAME, params: { id } },
    ]);
    onCleanup(() => handle.unsubscribe());
  });
}

export function usePuzzleEntity(puzzleId: Accessor<string>): PuzzleEntityView {
  const { rows } = createQuery(
    () => sql<PuzzleEntityRow>`
    SELECT fen, moves, rating, rating_deviation, themes
    FROM chess_puzzles
    WHERE id = ${puzzleId()}
      AND deleted_at IS NULL
  `
  );
  const row = (): PuzzleEntityRow | null => rows()[0] ?? null;
  useHydratePuzzleById(puzzleId, row);
  return puzzleEntityView(row);
}

/**
 * §34 "puzzle retired / edited after being prefetched": review reads the row
 * the attempt was played against, tombstone included. Retiring a puzzle soft-
 * deletes it, which takes it out of every feed and pick read — but the line
 * the player already attempted is still on that row, and a game-log entry
 * must keep opening rather than turning into a dead end.
 */
export function useReviewPuzzleEntity(
  puzzleId: Accessor<string>
): PuzzleEntityView {
  const { rows } = createQuery(
    () => sql<PuzzleEntityRow>`
    SELECT fen, moves, rating, rating_deviation, themes
    FROM chess_puzzles
    WHERE id = ${puzzleId()}
  `
  );
  const row = (): PuzzleEntityRow | null => rows()[0] ?? null;
  useHydratePuzzleById(puzzleId, row);
  return puzzleEntityView(row);
}

/** This actor's interaction rows for one puzzle, plus whether the first read landed. */
export function usePuzzleInteractions(puzzleId: Accessor<string>): {
  rows: Accessor<ChessPuzzleInteractionRow[]>;
  ready: Accessor<boolean>;
} {
  const myId = useMyId();
  const query = () => sql<InteractionSqlRow>`
      SELECT
        puzzle_id,
        kind,
        solve_idx,
        uci,
        correct,
        puzzle_rating,
        at
      FROM chess_puzzle_interactions
      WHERE owner_id = ${myId()}
        AND puzzle_id = ${puzzleId()}
      ORDER BY at ASC
      LIMIT ${INTERACTION_HISTORY_LIMIT}
    `;
  const { rows, isLoading } = createQuery(query);
  return {
    rows: createMemo(() => rows().map(interactionRowFromSql)),
    ready: createMemo(() => myId().length > 0 && !isLoading()),
  };
}

export function useChessPuzzleAllInteractions(): Accessor<
  ChessPuzzleInteractionRow[]
> {
  const myId = useMyId();
  const query = () => sql<InteractionSqlRow>`
      SELECT
        puzzle_id,
        kind,
        solve_idx,
        uci,
        correct,
        puzzle_rating,
        at
      FROM chess_puzzle_interactions
      WHERE owner_id = ${myId()}
      ORDER BY at DESC
      LIMIT ${INTERACTION_HISTORY_LIMIT}
    `;
  const { rows } = createQuery(query);
  return createMemo(() => rows().map(interactionRowFromSql));
}

export function usePuzzleEntityAndInteractions(puzzleId: Accessor<string>): {
  fen: string;
  movesStr: string;
  rating: number;
  ratingDeviation: number;
  themes: readonly string[];
  interactions: ChessPuzzleInteractionRow[];
  interactionsReady: boolean;
} {
  const base = usePuzzleEntity(puzzleId);
  const interactions = usePuzzleInteractions(puzzleId);
  return mergeProps(base, {
    get interactions() {
      return interactions.rows();
    },
    get interactionsReady() {
      return interactions.ready();
    },
  });
}
