import { PUZZLE_UPLOAD_MAX_CHUNKS } from '@libs/chess-puzzle-shared/puzzle-load-job';
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
  },
  upload: UploadPart
): Promise<number> {
  let chunks = 0;
  let rows = 0;
  for await (const part of puzzleCsvParts(puzzleFileStream(file))) {
    options.signal.throwIfAborted();
    if (chunks >= PUZZLE_UPLOAD_MAX_CHUNKS)
      throw new Error('The CSV is too large. Split it into smaller files.');
    await upload(options.uploadId, chunks, part.csv, options.signal);
    chunks += 1;
    rows += part.rows;
    options.onProgress(rows);
  }
  options.signal.throwIfAborted();
  if (chunks === 0) throw new Error('The CSV has a header but no puzzles.');
  return chunks;
}
