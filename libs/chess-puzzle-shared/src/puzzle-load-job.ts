/** A bounded CSV source part, staged before its job starts. */
export const PUZZLE_UPLOAD_MAX_BYTES = 256_000;
export const PUZZLE_UPLOAD_MAX_CHUNKS = 100_000;
export function puzzleUploadKey(
  actorId: string,
  uploadId: string,
  part: number
): string {
  return `chess/puzzle-uploads/${encodeURIComponent(actorId)}/${uploadId}/${String(part)}.csv`;
}

export function puzzleUploadPrefix(actorId: string, uploadId: string): string {
  return `chess/puzzle-uploads/${encodeURIComponent(actorId)}/${uploadId}/`;
}
