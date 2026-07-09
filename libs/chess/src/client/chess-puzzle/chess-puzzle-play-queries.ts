import { useMyId } from '@libs/auth/client/use-current-user';
import { useWatchQuery, useWatchValue } from '@pkgs/sync-engine/client/sync-engine-context';
import { useMemo } from 'react';

import {
  CHESS_PUZZLE_INTERACTIONS_TABLE,
  CHESS_PUZZLES_TABLE,
  ChessPuzzleCol,
  ChessPuzzleInteractionCol,
} from '../../shared/sync-tables';
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

function interactionRowFromSql(row: InteractionSqlRow): ChessPuzzleInteractionRow {
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

export function usePuzzleEntity(puzzleId: string): {
  fen: string;
  movesStr: string;
  rating: number;
  themes: readonly string[];
} {
  const { value: fen } = useWatchValue<string>(
    `SELECT ${ChessPuzzleCol.fen} AS value FROM ${CHESS_PUZZLES_TABLE.tableName} WHERE ${ChessPuzzleCol.id} = ?`,
    [puzzleId]
  );
  const { value: movesStr } = useWatchValue<string>(
    `SELECT ${ChessPuzzleCol.moves} AS value FROM ${CHESS_PUZZLES_TABLE.tableName} WHERE ${ChessPuzzleCol.id} = ?`,
    [puzzleId]
  );
  const { value: rating } = useWatchValue<number>(
    `SELECT ${ChessPuzzleCol.rating} AS value FROM ${CHESS_PUZZLES_TABLE.tableName} WHERE ${ChessPuzzleCol.id} = ?`,
    [puzzleId]
  );
  const { value: themesRaw } = useWatchValue<unknown>(
    `SELECT ${ChessPuzzleCol.themes} AS value FROM ${CHESS_PUZZLES_TABLE.tableName} WHERE ${ChessPuzzleCol.id} = ?`,
    [puzzleId]
  );
  const themes = readStringArray(themesRaw);

  return {
    fen: fen ?? '',
    movesStr: movesStr ?? '',
    rating: rating ?? 0,
    themes,
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
