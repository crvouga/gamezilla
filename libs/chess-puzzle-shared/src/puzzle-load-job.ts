export const CHESS_PUZZLE_OBJECT_KEY = 'chess/puzzles.ndjson';

export const PUZZLE_LOAD_STATUS = {
  adding: 'adding',
  finished: 'finished',
  failed: 'failed',
} as const;

export type PuzzleLoadStatus =
  (typeof PUZZLE_LOAD_STATUS)[keyof typeof PUZZLE_LOAD_STATUS];

export type PuzzleLoadJob = {
  readonly id: string;
  readonly status: PuzzleLoadStatus;
  readonly objectKey: string;
  readonly processedRows: number;
  readonly insertedRows: number;
  readonly failedRows: number;
  readonly error: string | null;
  readonly startedAt: string;
  readonly finishedAt: string | null;
};
