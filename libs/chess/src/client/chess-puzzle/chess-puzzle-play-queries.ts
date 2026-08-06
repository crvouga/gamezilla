import { useMyId } from '@libs/auth/client/use-current-user';
import { sql } from '@pkgs/sql';

import {
  useQuery,
  useQueryOne,
} from '@pkgs/sync-engine/client/sync-engine-context';
import { useMemo } from 'react';

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
  const { row } = useQueryOne(sql<PuzzleEntityRow>`
    SELECT fen, moves, rating, themes
    FROM chess_puzzles
    WHERE id = ${puzzleId}
  `);

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
  const query = useMemo(
    () => sql<InteractionSqlRow>`
      SELECT
        puzzle_id,
        kind,
        solve_idx,
        uci,
        correct,
        puzzle_rating,
        rating_before,
        rating_after,
        at
      FROM chess_puzzle_interactions
      WHERE owner_id = ${myId}
        AND puzzle_id = ${puzzleId}
      ORDER BY at ASC
      LIMIT 100
    `,
    [myId, puzzleId]
  );
  const { rows } = useQuery(query);
  return useMemo(() => rows.map(interactionRowFromSql), [rows]);
}

export function useChessPuzzleAllInteractions(): ChessPuzzleInteractionRow[] {
  const myId = useMyId();
  const query = useMemo(
    () => sql<InteractionSqlRow>`
      SELECT
        puzzle_id,
        kind,
        solve_idx,
        uci,
        correct,
        puzzle_rating,
        rating_before,
        rating_after,
        at
      FROM chess_puzzle_interactions
      WHERE owner_id = ${myId}
      ORDER BY at DESC
      LIMIT 100
    `,
    [myId]
  );
  const { rows } = useQuery(query);
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
