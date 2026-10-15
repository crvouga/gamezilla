import { z } from 'zod';
import { PUZZLE_UPLOAD_MAX_CHUNKS } from './puzzle-load-job';

export const puzzleSourceIdSchema = z.string().regex(/^[a-zA-Z0-9-]{1,80}$/);
export const savedPuzzleSourceSchema = z.object({
  id: puzzleSourceIdSchema,
  filename: z.string().min(1).max(255),
  chunks: z.number().int().min(1).max(PUZZLE_UPLOAD_MAX_CHUNKS),
});
export type SavedPuzzleSource = z.infer<typeof savedPuzzleSourceSchema>;
export const SAVED_PUZZLE_SOURCE_KEY = 'shared/chess/lichess/source.json';
