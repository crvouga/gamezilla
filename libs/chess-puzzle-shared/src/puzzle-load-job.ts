/** A bounded CSV source part, staged before its job starts. */
export const PUZZLE_UPLOAD_MAX_BYTES = 256_000;
export const PUZZLE_UPLOAD_MAX_CHUNKS = 100_000;
export function puzzleSourcePartKey(sourceId: string, part: number): string {
  return `${puzzleSourcePrefix(sourceId)}${String(part)}.csv`;
}

export function puzzleSourcePrefix(sourceId: string): string {
  return `shared/chess/lichess/${sourceId}/`;
}
