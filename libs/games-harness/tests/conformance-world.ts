/**
 * The games every shared suite and shared specification runs for: every
 * registered game, as production registers it, and the test-only reference
 * game beside them. Each is held to exactly what it offers.
 */

import {
  gameSystem,
  openGameHarness,
} from '@libs/game-session-harness/game-system';
import type { HarnessGame } from '@libs/game-session-harness/harness-game';
import { HARNESS_GAMES } from '@libs/games-harness/harness-games';
import type { OpenHarnessOptions } from '@libs/harness/mode';
import type { OpenHarness } from '@libs/harness/open-harness';
import { COUNTING_RACE_GAME } from './reference-game/counting-race-game';

export const CONFORMANCE_GAMES: readonly HarnessGame[] = [
  ...HARNESS_GAMES,
  COUNTING_RACE_GAME,
];

/** One world where every conformance game is offered at once. */
export const CONFORMANCE_SYSTEM = gameSystem('games', CONFORMANCE_GAMES);

export function openConformanceHarness(
  testId: string,
  options?: OpenHarnessOptions
): Promise<OpenHarness> {
  return openGameHarness(CONFORMANCE_SYSTEM, testId, options);
}
