import type { ContentAttempt } from '@libs/game-puzzle-shared-ts/attempt-types';
import type { PuzzlePlayContext } from './puzzle-content-client';

/**
 * Where an attempt is played, and whether the screen offers its own way on:
 * a playtest goes back to its builder and a pack's puzzle to its overview or
 * next puzzle (`ContentAttemptNext`); a puzzle on its own offers neither.
 */
export function puzzlePlayContext(
  attempt: Pick<ContentAttempt, 'mode' | 'pack_revision_id'>
): PuzzlePlayContext {
  if (attempt.mode === 'playtest')
    return { kind: 'playtest', shellOffersWayOn: true };
  if (attempt.pack_revision_id !== null)
    return { kind: 'pack', shellOffersWayOn: true };
  return { kind: 'single', shellOffersWayOn: false };
}
