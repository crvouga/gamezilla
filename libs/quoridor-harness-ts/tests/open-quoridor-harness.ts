import {
  gameSystem,
  openGameHarness,
} from '@libs/game-session-harness-ts/game-system';
import type { OpenHarnessOptions } from '@libs/harness-ts/mode';
import type { OpenHarness } from '@libs/harness-ts/open-harness';
import {
  QUORIDOR_HARNESS_GAME,
  QUORIDOR_HILL_HARNESS_GAME,
} from '@libs/quoridor-harness-ts/quoridor-harness-game';

const QUORIDOR_SYSTEM = gameSystem('quoridor', [
  QUORIDOR_HARNESS_GAME,
  QUORIDOR_HILL_HARNESS_GAME,
]);

export function openHarness(
  testId: string,
  options?: OpenHarnessOptions
): Promise<OpenHarness> {
  return openGameHarness(QUORIDOR_SYSTEM, testId, options);
}
