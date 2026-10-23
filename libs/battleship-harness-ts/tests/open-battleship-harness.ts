import { BATTLESHIP_HARNESS_GAME } from '@libs/battleship-harness-ts/battleship-harness-game';
import {
  gameSystem,
  openGameHarness,
} from '@libs/game-session-harness-ts/game-system';
import type { OpenHarnessOptions } from '@libs/harness-ts/mode';
import type { OpenHarness } from '@libs/harness-ts/open-harness';

/** Battleship's own suites run with Battleship as the only game. */
const BATTLESHIP_SYSTEM = gameSystem('battleship', [BATTLESHIP_HARNESS_GAME]);

export function openHarness(
  testId: string,
  options?: OpenHarnessOptions
): Promise<OpenHarness> {
  return openGameHarness(BATTLESHIP_SYSTEM, testId, options);
}
