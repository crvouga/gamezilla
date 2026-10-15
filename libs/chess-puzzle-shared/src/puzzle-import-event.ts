import {
  createMessageNamespace,
  isPlainRecord,
} from '@pkgs/message-shared/message';

const ns = createMessageNamespace('chess-puzzle-import');
export const PuzzleImportRequested = ns(
  'requested',
  (value: unknown): value is { uploadId: string; part: number } =>
    isPlainRecord(value) &&
    typeof value['uploadId'] === 'string' &&
    typeof value['part'] === 'number' &&
    Number.isInteger(value['part']) &&
    value['part'] >= 0
);

export const PuzzleImportCleanup = ns(
  'cleanup',
  (value: unknown): value is { actorId: string; uploadId: string } =>
    isPlainRecord(value) &&
    typeof value['actorId'] === 'string' &&
    typeof value['uploadId'] === 'string'
);
