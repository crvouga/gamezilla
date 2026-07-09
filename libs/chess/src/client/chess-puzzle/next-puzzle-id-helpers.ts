import {
  CHESS_PUZZLES_TABLE,
  CHESS_PUZZLE_INTERACTIONS_TABLE,
  ChessPuzzleInteractionCol,
} from '../../shared/sync-tables';

export const PUZZLE_NEXT_MAX_BAND = 400;
export const PUZZLE_CANDIDATE_LIMIT = 50;
/** Rotates candidate window so "Next" does not always hit the same top-N popular puzzles. */
export const PUZZLE_CANDIDATE_MAX_OFFSET = 150;

/** PowerSync `chess_puzzles` stream bands to cover puzzle picking for `rating`. */
export function chessPuzzleSyncRatingBands(rating: number): readonly number[] {
  const centerBand = Math.floor(rating / PUZZLE_NEXT_MAX_BAND);
  const spread = 2;
  const bands: number[] = [];
  for (let band = centerBand - spread; band <= centerBand + spread; band += 1) {
    if (band >= 0) bands.push(band);
  }
  return bands;
}

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

export function buildPuzzleCandidatesSql(
  rating: number,
  halfWindow: number | null,
  ownerId: string,
  currentPuzzleId: string | null,
  pickOffset = 0
): { readonly sql: string; readonly params: readonly unknown[] } {
  const params: unknown[] = [];
  let sql = `SELECT id, rating FROM ${CHESS_PUZZLES_TABLE.tableName} WHERE 1=1`;
  if (halfWindow !== null) {
    sql += ' AND rating >= ? AND rating <= ?';
    params.push(Math.max(0, rating - halfWindow), rating + halfWindow);
  }
  if (ownerId.length > 0) {
    sql +=
      ` AND id NOT IN (SELECT ${ChessPuzzleInteractionCol.puzzleId} FROM ${CHESS_PUZZLE_INTERACTIONS_TABLE.tableName} WHERE ${ChessPuzzleInteractionCol.ownerId} = ?)`;
    params.push(ownerId);
  }
  if (currentPuzzleId !== null && currentPuzzleId.length > 0) {
    sql += ' AND id != ?';
    params.push(currentPuzzleId);
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
  const inBand = rows.filter((r) => Math.abs(r.rating - rating) <= preferredBand);
  const pool = inBand.length > 0 ? inBand : rows;
  const idx = hashSeed(seed) % pool.length;
  return pool[idx]?.id ?? null;
}
