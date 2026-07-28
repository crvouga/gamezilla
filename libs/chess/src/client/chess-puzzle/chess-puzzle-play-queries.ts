import { useMyId } from '@libs/auth/client/use-current-user';
import {
  useWatchOne,
  useWatchQuery,
} from '@pkgs/sync-engine/client/sync-engine-context';
import { sql, type Sql, ident } from '@pkgs/sql';
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
  const { row } = useWatchOne<PuzzleEntityRow>(sql`
    SELECT ${ident(ChessPuzzleCol.fen)} AS fen, ${ident(ChessPuzzleCol.moves)} AS moves,
            ${ident(ChessPuzzleCol.rating)} AS rating, ${ident(ChessPuzzleCol.themes)} AS themes
     FROM ${ident(CHESS_PUZZLES_TABLE.tableName)}
     WHERE ${ident(ChessPuzzleCol.id)} = ${puzzleId}
  `);

  return {
    fen: row?.fen ?? '',
    movesStr: row?.moves ?? '',
    rating: row?.rating ?? 0,
    themes: readStringArray(row?.themes),
  };
}

const EMPTY_INTERACTIONS_QUERY = sql`SELECT ${ident(ChessPuzzleInteractionCol.puzzleId)} AS puzzle_id FROM ${ident(CHESS_PUZZLE_INTERACTIONS_TABLE.tableName)} WHERE 0`;

export function usePuzzleInteractions(
  puzzleId: string
): ChessPuzzleInteractionRow[] {
  const myId = useMyId();
  const query = useMemo<Sql>(
    () =>
      myId.length > 0
        ? sql`SELECT ${ident(ChessPuzzleInteractionCol.puzzleId)} AS puzzle_id,
                ${ident(ChessPuzzleInteractionCol.kind)} AS kind,
                ${ident(ChessPuzzleInteractionCol.solveIdx)} AS solve_idx,
                ${ident(ChessPuzzleInteractionCol.uci)} AS uci,
                ${ident(ChessPuzzleInteractionCol.correct)} AS correct,
                ${ident(ChessPuzzleInteractionCol.puzzleRating)} AS puzzle_rating,
                ${ident(ChessPuzzleInteractionCol.ratingBefore)} AS rating_before,
                ${ident(ChessPuzzleInteractionCol.ratingAfter)} AS rating_after,
                ${ident(ChessPuzzleInteractionCol.at)} AS at
         FROM ${ident(CHESS_PUZZLE_INTERACTIONS_TABLE.tableName)}
         WHERE ${ident(ChessPuzzleInteractionCol.ownerId)} = ${myId} AND ${ident(ChessPuzzleInteractionCol.puzzleId)} = ${puzzleId}
         ORDER BY ${ident(ChessPuzzleInteractionCol.at)} ASC
         LIMIT 100`
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
        ? sql`SELECT ${ident(ChessPuzzleInteractionCol.puzzleId)} AS puzzle_id,
                ${ident(ChessPuzzleInteractionCol.kind)} AS kind,
                ${ident(ChessPuzzleInteractionCol.solveIdx)} AS solve_idx,
                ${ident(ChessPuzzleInteractionCol.uci)} AS uci,
                ${ident(ChessPuzzleInteractionCol.correct)} AS correct,
                ${ident(ChessPuzzleInteractionCol.puzzleRating)} AS puzzle_rating,
                ${ident(ChessPuzzleInteractionCol.ratingBefore)} AS rating_before,
                ${ident(ChessPuzzleInteractionCol.ratingAfter)} AS rating_after,
                ${ident(ChessPuzzleInteractionCol.at)} AS at
         FROM ${ident(CHESS_PUZZLE_INTERACTIONS_TABLE.tableName)}
         WHERE ${ident(ChessPuzzleInteractionCol.ownerId)} = ${myId}
         ORDER BY ${ident(ChessPuzzleInteractionCol.at)} DESC
         LIMIT 100`
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
