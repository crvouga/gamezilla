import {
  gameSystem,
  openGameHarness,
} from '@libs/game-session-harness-ts/game-system';
import type { OpenHarnessOptions } from '@libs/harness-ts/mode';
import type { OpenHarness } from '@libs/harness-ts/open-harness';
import { HEARTS_HARNESS_GAME } from '@libs/hearts-harness-ts/hearts-harness-game';

/** Hearts' own suites run with Hearts as the only game. */
const HEARTS_SYSTEM = gameSystem('hearts', [HEARTS_HARNESS_GAME]);

export function openHarness(
  testId: string,
  options?: OpenHarnessOptions
): Promise<OpenHarness> {
  return openGameHarness(HEARTS_SYSTEM, testId, options);
}
