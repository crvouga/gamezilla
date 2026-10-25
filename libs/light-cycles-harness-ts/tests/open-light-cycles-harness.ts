import {
  gameSystem,
  openGameHarness,
} from '@libs/game-session-harness-ts/game-system';
import type { OpenHarnessOptions } from '@libs/harness-ts/mode';
import type { OpenHarness } from '@libs/harness-ts/open-harness';
import {
  LIGHT_CYCLES_DUEL_HARNESS_GAME,
  LIGHT_CYCLES_QUAD_HARNESS_GAME,
  LIGHT_CYCLES_TRIO_HARNESS_GAME,
} from '@libs/light-cycles-harness-ts/light-cycles-harness-game';

/** Every mode is its own game, registered as production registers it. */
const LIGHT_CYCLES_SYSTEM = gameSystem('light-cycles', [
  LIGHT_CYCLES_DUEL_HARNESS_GAME,
  LIGHT_CYCLES_TRIO_HARNESS_GAME,
  LIGHT_CYCLES_QUAD_HARNESS_GAME,
]);

export function openHarness(
  testId: string,
  options?: OpenHarnessOptions
): Promise<OpenHarness> {
  return openGameHarness(LIGHT_CYCLES_SYSTEM, testId, options);
}
