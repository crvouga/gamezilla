import { empty, join, sql, type Sql, type SqlFragment } from '@pkgs/sql';

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
): Sql<PuzzleCandidateRow> {
  const pickOffset = args.pickOffset ?? 0;
  const conditions: SqlFragment[] = [];
  if (args.halfWindow !== null) {
    conditions.push(
      sql<void>`rating >= ${Math.max(0, args.rating - args.halfWindow)}`,
      sql<void>`rating <= ${args.rating + args.halfWindow}`
    );
  }
  if (args.ownerId.length > 0) {
    conditions.push(sql<void>`
      id NOT IN (
        SELECT puzzle_id
        FROM chess_puzzle_interactions
        WHERE owner_id = ${args.ownerId}
      )
    `);
  }
  if (args.currentPuzzleId !== null && args.currentPuzzleId.length > 0) {
    conditions.push(sql<void>`id != ${args.currentPuzzleId}`);
  }
  const whereClause: SqlFragment =
    conditions.length > 0
      ? sql<void>`WHERE ${join(conditions, ' AND ')}`
      : empty;

  return sql<PuzzleCandidateRow>`
    SELECT id, rating
    FROM chess_puzzles
    ${whereClause}
    ORDER BY popularity DESC
    LIMIT ${PUZZLE_CANDIDATE_LIMIT}
    OFFSET ${pickOffset}
  `;
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
