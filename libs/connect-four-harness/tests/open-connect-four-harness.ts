import { CONNECT_FOUR_HARNESS_GAME } from '@libs/connect-four-harness/connect-four-harness-game';
import {
  gameSystem,
  openGameHarness,
} from '@libs/game-session-harness/game-system';
import type { OpenHarnessOptions } from '@libs/harness/mode';
import type { OpenHarness } from '@libs/harness/open-harness';

/** Connect Four's own suites run with Connect Four as the only game. */
const CONNECT_FOUR_SYSTEM = gameSystem('connect-four', [
  CONNECT_FOUR_HARNESS_GAME,
]);

export function openHarness(
  testId: string,
  options?: OpenHarnessOptions
): Promise<OpenHarness> {
  return openGameHarness(CONNECT_FOUR_SYSTEM, testId, options);
}
