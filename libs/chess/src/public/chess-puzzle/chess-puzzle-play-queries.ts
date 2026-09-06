import { useMyId } from '@libs/auth/public/use-current-user';
import { sql } from '@pkgs/sql';

import { createQuery } from '@pkgs/sync-engine/solid';
import { type Accessor, createMemo, mergeProps } from 'solid-js';

import type { ChessPuzzleInteractionRow } from '../chess-puzzle-interaction-entities';

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

export function usePuzzleEntity(puzzleId: Accessor<string>): {
  fen: string;
  movesStr: string;
  rating: number;
  themes: readonly string[];
} {
  const { rows } = createQuery(
    () => sql<PuzzleEntityRow>`
    SELECT fen, moves, rating, themes
    FROM chess_puzzles
    WHERE id = ${puzzleId()}
  `
  );
  const row = () => rows()[0] ?? null;

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
    get themes() {
      return readStringArray(row()?.themes);
    },
  };
}

export function usePuzzleInteractions(
  puzzleId: Accessor<string>
): Accessor<ChessPuzzleInteractionRow[]> {
  const myId = useMyId();
  const query = () => sql<InteractionSqlRow>`
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
      WHERE owner_id = ${myId()}
        AND puzzle_id = ${puzzleId()}
      ORDER BY at ASC
      LIMIT 100
    `;
  const { rows } = createQuery(query);
  return createMemo(() => rows().map(interactionRowFromSql));
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
        rating_before,
        rating_after,
        at
      FROM chess_puzzle_interactions
      WHERE owner_id = ${myId()}
      ORDER BY at DESC
      LIMIT 100
    `;
  const { rows } = createQuery(query);
  return createMemo(() => rows().map(interactionRowFromSql));
}

export function usePuzzleEntityAndInteractions(puzzleId: Accessor<string>): {
  fen: string;
  movesStr: string;
  rating: number;
  themes: readonly string[];
  interactions: ChessPuzzleInteractionRow[];
} {
  const base = usePuzzleEntity(puzzleId);
  const interactions = usePuzzleInteractions(puzzleId);
  return mergeProps(base, {
    get interactions() {
      return interactions();
    },
  });
}
