import type { SavedPuzzleSource } from '@libs/chess-puzzle-shared-ts/puzzle-source';
import type { usePuzzleManagementApi } from './puzzle-management-api';
import { PuzzleSourceRequestError } from './puzzle-management-api';
import { uploadPuzzleSource } from './upload-puzzle-source';

/** A stale first-file choice reuses the complete file another environment saved. */
export async function savePuzzleSource(
  file: File,
  options: {
    uploadId: string;
    signal: AbortSignal;
    onProgress: (rows: number) => void;
    onFileProgress?: (fraction: number) => void;
  },
  api: ReturnType<typeof usePuzzleManagementApi>
): Promise<SavedPuzzleSource> {
  const existing = await api.read(options.signal);
  if (existing !== null) return existing;
  try {
    const chunks = await uploadPuzzleSource(file, options, api.upload);
    const result = await api.save(
      { id: options.uploadId, filename: file.name, chunks },
      options.signal
    );
    if (result === null)
      throw new Error('The Lichess file could not be saved.');
    return result;
  } catch (error) {
    if (error instanceof PuzzleSourceRequestError && error.status === 409) {
      const saved = await api.read(options.signal);
      if (saved !== null) return saved;
    }
    throw error;
  }
}
