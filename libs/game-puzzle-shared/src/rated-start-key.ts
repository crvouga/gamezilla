import { ACTION } from '@libs/permissions-shared/permission-catalog';

function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** What every rated-start key for `puzzleId` begins with, whatever the day. */
export function ratedStartKeyPrefix(puzzleId: string): string {
  return `${ACTION.puzzleRatedSolve}:${puzzleId}:`;
}

/**
 * The rated-puzzle quota's idempotency key for starting `puzzleId` on the
 * UTC day `atMs` falls in: re-placing the same puzzle that day is the same
 * start, so it is charged once.
 */
export function ratedStartKey(puzzleId: string, atMs: number): string {
  return `${ratedStartKeyPrefix(puzzleId)}${utcDay(atMs)}`;
}
