export const PUZZLE_NEXT_MAX_BAND = 400;

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
  currentPuzzleId: string | null
): { readonly sql: string; readonly params: readonly unknown[] } {
  const params: unknown[] = [];
  let sql = 'SELECT id, rating FROM chess_puzzles WHERE 1=1';
  if (halfWindow !== null) {
    sql += ' AND rating >= ? AND rating <= ?';
    params.push(Math.max(0, rating - halfWindow), rating + halfWindow);
  }
  if (ownerId.length > 0) {
    sql +=
      ' AND id NOT IN (SELECT puzzle_id FROM chess_puzzle_interactions WHERE owner_id = ?)';
    params.push(ownerId);
  }
  if (currentPuzzleId !== null && currentPuzzleId.length > 0) {
    sql += ' AND id != ?';
    params.push(currentPuzzleId);
  }
  sql += ' ORDER BY popularity DESC LIMIT 50';
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
