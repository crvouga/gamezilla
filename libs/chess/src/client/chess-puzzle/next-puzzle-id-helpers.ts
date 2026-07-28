import {
  CHESS_PUZZLE_INTERACTIONS_TABLE,
  CHESS_PUZZLES_TABLE,
  ChessPuzzleInteractionCol,
} from '@libs/db/shared/chess-tables';
import { empty, raw, sql, type Sql } from '@pkgs/sql';
import { PUZZLE_RATING_BAND_SIZE } from '../../shared/chess-puzzle-feed-config';

export { chessPuzzleSyncRatingBands } from '../../shared/chess-puzzle-feed-config';

export const PUZZLE_NEXT_MAX_BAND = PUZZLE_RATING_BAND_SIZE;
export const PUZZLE_CANDIDATE_LIMIT = 50;
/** Rotates candidate window so "Next" does not always hit the same top-N popular puzzles. */
export const PUZZLE_CANDIDATE_MAX_OFFSET = 150;

export function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export type PuzzleCandidateRow = {
  readonly id: string;
  readonly rating: number;
};

export type BuildPuzzleCandidatesSqlArgs = {
  readonly rating: number;
  readonly halfWindow: number | null;
  readonly ownerId: string;
  readonly currentPuzzleId: string | null;
  readonly pickOffset?: number;
};

export function buildPuzzleCandidatesSql(
  args: BuildPuzzleCandidatesSqlArgs
): Sql {
  const pickOffset = args.pickOffset ?? 0;
  const ratingFilter =
    args.halfWindow !== null
      ? sql`AND rating >= ${Math.max(0, args.rating - args.halfWindow)} AND rating <= ${args.rating + args.halfWindow}`
      : empty;
  const ownerFilter =
    args.ownerId.length > 0
      ? sql`AND id NOT IN (SELECT ${raw(ChessPuzzleInteractionCol.puzzleId)} FROM ${raw(CHESS_PUZZLE_INTERACTIONS_TABLE.tableName)} WHERE ${raw(ChessPuzzleInteractionCol.ownerId)} = ${args.ownerId})`
      : empty;
  const currentPuzzleFilter =
    args.currentPuzzleId !== null && args.currentPuzzleId.length > 0
      ? sql`AND id != ${args.currentPuzzleId}`
      : empty;
  return sql`SELECT id, rating FROM ${raw(CHESS_PUZZLES_TABLE.tableName)} WHERE 1=1
    ${ratingFilter}
    ${ownerFilter}
    ${currentPuzzleFilter}
    ORDER BY popularity DESC LIMIT ${PUZZLE_CANDIDATE_LIMIT} OFFSET ${pickOffset}`;
}

export function pickPuzzleIdFromPool(args: {
  rows: readonly PuzzleCandidateRow[];
  rating: number;
  preferredBand: number;
  seed: string;
}): string | null {
  const { rows, rating, preferredBand, seed } = args;
  if (rows.length === 0) return null;
  const inBand = rows.filter(
    (r) => Math.abs(r.rating - rating) <= preferredBand
  );
  const pool = inBand.length > 0 ? inBand : rows;
  const idx = hashSeed(seed) % pool.length;
  return pool[idx]?.id ?? null;
}
