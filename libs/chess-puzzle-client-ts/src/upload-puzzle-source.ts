import { PUZZLE_UPLOAD_MAX_CHUNKS } from '@libs/chess-puzzle-shared-ts/puzzle-load-job';
import { puzzleCsvParts } from './puzzle-csv-parts';
import { puzzleFileStream } from './puzzle-file-stream';

type UploadPart = (
  uploadId: string,
  part: number,
  csv: string,
  signal: AbortSignal
) => Promise<void>;

export async function uploadPuzzleSource(
  file: File,
  options: {
    uploadId: string;
    signal: AbortSignal;
    onProgress: (rows: number) => void;
    onFileProgress?: (fraction: number) => void;
  },
  upload: UploadPart
): Promise<number> {
  let chunks = 0;
  let rows = 0;
  let consumed = 0;
  const input = puzzleFileStream(file, (bytes) => {
    consumed = bytes;
  });
  for await (const part of puzzleCsvParts(input)) {
    options.signal.throwIfAborted();
    if (chunks >= PUZZLE_UPLOAD_MAX_CHUNKS)
      throw new Error('The CSV is too large. Split it into smaller files.');
    await upload(options.uploadId, chunks, part.csv, options.signal);
    chunks += 1;
    rows += part.rows;
    options.onProgress(rows);
    // Reserve completion for publishing the shared manifest after all parts.
    options.onFileProgress?.(Math.min(consumed / Math.max(file.size, 1), 0.99));
  }
  options.signal.throwIfAborted();
  if (chunks === 0) throw new Error('The CSV has a header but no puzzles.');
  return chunks;
}
