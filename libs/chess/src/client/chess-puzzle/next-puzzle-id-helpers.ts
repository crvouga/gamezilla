import {
  CHESS_PUZZLE_INTERACTIONS_TABLE,
  CHESS_PUZZLES_TABLE,
  ChessPuzzleCol,
  ChessPuzzleInteractionCol,
} from '@libs/db/shared/chess-tables';
import { honey, type Expr, type Sql } from '@pkgs/sql';
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
  const conditions: Expr[] = [];
  if (args.halfWindow !== null) {
    conditions.push(
      ['>=', ChessPuzzleCol.rating, Math.max(0, args.rating - args.halfWindow)],
      ['<=', ChessPuzzleCol.rating, args.rating + args.halfWindow]
    );
  }
  if (args.ownerId.length > 0) {
    conditions.push([
      'not-in',
      ChessPuzzleCol.id,
      {
        select: [ChessPuzzleInteractionCol.puzzleId],
        from: CHESS_PUZZLE_INTERACTIONS_TABLE.tableName,
        where: ['=', ChessPuzzleInteractionCol.ownerId, args.ownerId],
      },
    ]);
  }
  if (args.currentPuzzleId !== null && args.currentPuzzleId.length > 0) {
    conditions.push(['!=', ChessPuzzleCol.id, args.currentPuzzleId]);
  }
  return honey({
    select: [ChessPuzzleCol.id, ChessPuzzleCol.rating],
    from: CHESS_PUZZLES_TABLE.tableName,
    ...(conditions.length > 0 ? { where: ['and', ...conditions] } : {}),
    orderBy: [[ChessPuzzleCol.popularity, 'desc']],
    limit: PUZZLE_CANDIDATE_LIMIT,
    offset: pickOffset,
  });
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
