import { useMyId } from '@libs/auth/client/use-current-user';
import {
  useWatchOne,
  useWatchQuery,
} from '@pkgs/sync-engine/client/sync-engine-context';
import { useMemo } from 'react';

import {
  CHESS_PUZZLE_FEED_TABLE,
  CHESS_PUZZLE_INTERACTIONS_TABLE,
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
    `SELECT ${ChessPuzzleCol.fen} AS fen, ${ChessPuzzleCol.moves} AS moves,
            ${ChessPuzzleCol.rating} AS rating, ${ChessPuzzleCol.themes} AS themes
     FROM ${CHESS_PUZZLE_FEED_TABLE.tableName}
     WHERE ${ChessPuzzleCol.id} = ?`,
    [puzzleId]
  );

  return {
    fen: row?.fen ?? '',
    movesStr: row?.moves ?? '',
    rating: row?.rating ?? 0,
    themes: readStringArray(row?.themes),
  };
}

export function usePuzzleInteractions(
  puzzleId: string
): ChessPuzzleInteractionRow[] {
  const myId = useMyId();
  const { rows } = useWatchQuery<InteractionSqlRow>(
    myId.length > 0
      ? `SELECT ${ChessPuzzleInteractionCol.puzzleId} AS puzzle_id,
                ${ChessPuzzleInteractionCol.kind} AS kind,
                ${ChessPuzzleInteractionCol.solveIdx} AS solve_idx,
                ${ChessPuzzleInteractionCol.uci} AS uci,
                ${ChessPuzzleInteractionCol.correct} AS correct,
                ${ChessPuzzleInteractionCol.puzzleRating} AS puzzle_rating,
                ${ChessPuzzleInteractionCol.ratingBefore} AS rating_before,
                ${ChessPuzzleInteractionCol.ratingAfter} AS rating_after,
                ${ChessPuzzleInteractionCol.at} AS at
         FROM ${CHESS_PUZZLE_INTERACTIONS_TABLE.tableName}
         WHERE ${ChessPuzzleInteractionCol.ownerId} = ? AND ${ChessPuzzleInteractionCol.puzzleId} = ?
         ORDER BY ${ChessPuzzleInteractionCol.at} ASC
         LIMIT 100`
      : `SELECT ${ChessPuzzleInteractionCol.puzzleId} AS puzzle_id FROM ${CHESS_PUZZLE_INTERACTIONS_TABLE.tableName} WHERE 0`,
    myId.length > 0 ? [myId, puzzleId] : []
  );
  return useMemo(() => rows.map(interactionRowFromSql), [rows]);
}

export function useChessPuzzleAllInteractions(): ChessPuzzleInteractionRow[] {
  const myId = useMyId();
  const { rows } = useWatchQuery<InteractionSqlRow>(
    myId.length > 0
      ? `SELECT ${ChessPuzzleInteractionCol.puzzleId} AS puzzle_id,
                ${ChessPuzzleInteractionCol.kind} AS kind,
                ${ChessPuzzleInteractionCol.solveIdx} AS solve_idx,
                ${ChessPuzzleInteractionCol.uci} AS uci,
                ${ChessPuzzleInteractionCol.correct} AS correct,
                ${ChessPuzzleInteractionCol.puzzleRating} AS puzzle_rating,
                ${ChessPuzzleInteractionCol.ratingBefore} AS rating_before,
                ${ChessPuzzleInteractionCol.ratingAfter} AS rating_after,
                ${ChessPuzzleInteractionCol.at} AS at
         FROM ${CHESS_PUZZLE_INTERACTIONS_TABLE.tableName}
         WHERE ${ChessPuzzleInteractionCol.ownerId} = ?
         ORDER BY ${ChessPuzzleInteractionCol.at} DESC
         LIMIT 100`
      : `SELECT ${ChessPuzzleInteractionCol.puzzleId} AS puzzle_id FROM ${CHESS_PUZZLE_INTERACTIONS_TABLE.tableName} WHERE 0`,
    myId.length > 0 ? [myId] : []
  );
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
