import {
  CHESS_PUZZLES_TABLE,
  CHESS_PUZZLE_INTERACTIONS_TABLE,
  ChessPuzzleInteractionCol,
} from '@libs/db/shared/chess-tables';
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

export function buildPuzzleCandidatesSql(args: BuildPuzzleCandidatesSqlArgs): {
  readonly sql: string;
  readonly params: readonly unknown[];
} {
  const pickOffset = args.pickOffset ?? 0;
  const params: unknown[] = [];
  let sql = `SELECT id, rating FROM ${CHESS_PUZZLES_TABLE.tableName} WHERE 1=1`;
  if (args.halfWindow !== null) {
    sql += ' AND rating >= ? AND rating <= ?';
    params.push(
      Math.max(0, args.rating - args.halfWindow),
      args.rating + args.halfWindow
    );
  }
  if (args.ownerId.length > 0) {
    sql += ` AND id NOT IN (SELECT ${ChessPuzzleInteractionCol.puzzleId} FROM ${CHESS_PUZZLE_INTERACTIONS_TABLE.tableName} WHERE ${ChessPuzzleInteractionCol.ownerId} = ?)`;
    params.push(args.ownerId);
  }
  if (args.currentPuzzleId !== null && args.currentPuzzleId.length > 0) {
    sql += ' AND id != ?';
    params.push(args.currentPuzzleId);
  }
  sql += ' ORDER BY popularity DESC LIMIT ? OFFSET ?';
  params.push(PUZZLE_CANDIDATE_LIMIT, pickOffset);
  return { sql, params };
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
