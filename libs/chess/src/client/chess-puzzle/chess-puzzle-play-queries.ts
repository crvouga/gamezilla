import { useMyId } from '@libs/auth/client/use-current-user';
import { sqlMap, type Sql } from '@pkgs/sql';
import {
  useWatchOne,
  useWatchQuery,
} from '@pkgs/sync-engine/client/sync-engine-context';
import { useMemo } from 'react';

import {
  CHESS_PUZZLE_INTERACTIONS_TABLE,
  CHESS_PUZZLES_TABLE,
  ChessPuzzleCol,
  ChessPuzzleInteractionCol,
} from '@libs/db/shared/chess-tables';
import type { ChessPuzzleInteractionRow } from '../../shared/chess-puzzle-interaction-entities';

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
  readonly rating_before: number;
  readonly rating_after: number;
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
    ratingBefore: row.rating_before,
    ratingAfter: row.rating_after,
    at: row.at,
  };
}

type PuzzleEntityRow = {
  readonly fen: string | null;
  readonly moves: string | null;
  readonly rating: number | null;
  readonly themes: unknown;
};

export function usePuzzleEntity(puzzleId: string): {
  fen: string;
  movesStr: string;
  rating: number;
  themes: readonly string[];
} {
  const { row } = useWatchOne<PuzzleEntityRow>(
    sqlMap({
      select: [
        [ChessPuzzleCol.fen, 'fen'],
        [ChessPuzzleCol.moves, 'moves'],
        [ChessPuzzleCol.rating, 'rating'],
        [ChessPuzzleCol.themes, 'themes'],
      ],
      from: CHESS_PUZZLES_TABLE.tableName,
      where: ['=', ChessPuzzleCol.id, puzzleId],
    })
  );

  return {
    fen: row?.fen ?? '',
    movesStr: row?.moves ?? '',
    rating: row?.rating ?? 0,
    themes: readStringArray(row?.themes),
  };
}

const EMPTY_INTERACTIONS_QUERY = sqlMap({
  select: [[ChessPuzzleInteractionCol.puzzleId, 'puzzle_id']],
  from: CHESS_PUZZLE_INTERACTIONS_TABLE.tableName,
  where: ['=', 1, 0],
});

export function usePuzzleInteractions(
  puzzleId: string
): ChessPuzzleInteractionRow[] {
  const myId = useMyId();
  const query = useMemo<Sql>(
    () =>
      myId.length > 0
        ? sqlMap({
            select: [
              [ChessPuzzleInteractionCol.puzzleId, 'puzzle_id'],
              [ChessPuzzleInteractionCol.kind, 'kind'],
              [ChessPuzzleInteractionCol.solveIdx, 'solve_idx'],
              [ChessPuzzleInteractionCol.uci, 'uci'],
              [ChessPuzzleInteractionCol.correct, 'correct'],
              [ChessPuzzleInteractionCol.puzzleRating, 'puzzle_rating'],
              [ChessPuzzleInteractionCol.ratingBefore, 'rating_before'],
              [ChessPuzzleInteractionCol.ratingAfter, 'rating_after'],
              [ChessPuzzleInteractionCol.at, 'at'],
            ],
            from: CHESS_PUZZLE_INTERACTIONS_TABLE.tableName,
            where: [
              'and',
              ['=', ChessPuzzleInteractionCol.ownerId, myId],
              ['=', ChessPuzzleInteractionCol.puzzleId, puzzleId],
            ],
            orderBy: [[ChessPuzzleInteractionCol.at, 'asc']],
            limit: 100,
          })
        : EMPTY_INTERACTIONS_QUERY,
    [myId, puzzleId]
  );
  const { rows } = useWatchQuery<InteractionSqlRow>(query);
  return useMemo(() => rows.map(interactionRowFromSql), [rows]);
}

export function useChessPuzzleAllInteractions(): ChessPuzzleInteractionRow[] {
  const myId = useMyId();
  const query = useMemo<Sql>(
    () =>
      myId.length > 0
        ? sqlMap({
            select: [
              [ChessPuzzleInteractionCol.puzzleId, 'puzzle_id'],
              [ChessPuzzleInteractionCol.kind, 'kind'],
              [ChessPuzzleInteractionCol.solveIdx, 'solve_idx'],
              [ChessPuzzleInteractionCol.uci, 'uci'],
              [ChessPuzzleInteractionCol.correct, 'correct'],
              [ChessPuzzleInteractionCol.puzzleRating, 'puzzle_rating'],
              [ChessPuzzleInteractionCol.ratingBefore, 'rating_before'],
              [ChessPuzzleInteractionCol.ratingAfter, 'rating_after'],
              [ChessPuzzleInteractionCol.at, 'at'],
            ],
            from: CHESS_PUZZLE_INTERACTIONS_TABLE.tableName,
            where: ['=', ChessPuzzleInteractionCol.ownerId, myId],
            orderBy: [[ChessPuzzleInteractionCol.at, 'desc']],
            limit: 100,
          })
        : EMPTY_INTERACTIONS_QUERY,
    [myId]
  );
  const { rows } = useWatchQuery<InteractionSqlRow>(query);
  return useMemo(() => rows.map(interactionRowFromSql), [rows]);
}

export function usePuzzleEntityAndInteractions(puzzleId: string): {
  fen: string;
  movesStr: string;
  rating: number;
  themes: readonly string[];
  interactions: ChessPuzzleInteractionRow[];
} {
  const base = usePuzzleEntity(puzzleId);
  const interactions = usePuzzleInteractions(puzzleId);
  return { ...base, interactions };
}
