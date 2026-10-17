import {
  gameSystem,
  openGameHarness,
} from '@libs/game-session-harness/game-system';
import type { OpenHarnessOptions } from '@libs/harness/mode';
import type { OpenHarness } from '@libs/harness/open-harness';
import { HARNESS_GAMES } from './harness-games';

/** The world the shared game suites run in: every registered game at once. */
export const GAMES_SYSTEM = gameSystem('games', HARNESS_GAMES);

export function openGamesHarness(
  testId: string,
  options?: OpenHarnessOptions
): Promise<OpenHarness> {
  return openGameHarness(GAMES_SYSTEM, testId, options);
}
