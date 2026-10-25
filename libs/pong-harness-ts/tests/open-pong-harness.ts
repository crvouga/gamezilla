import {
  gameSystem,
  openGameHarness,
} from '@libs/game-session-harness-ts/game-system';
import type { OpenHarnessOptions } from '@libs/harness-ts/mode';
import type { OpenHarness } from '@libs/harness-ts/open-harness';
import { PONG_HARNESS_GAME } from '@libs/pong-harness-ts/pong-harness-game';

const PONG_SYSTEM = gameSystem('pong', [PONG_HARNESS_GAME]);

export function openHarness(
  testId: string,
  options?: OpenHarnessOptions
): Promise<OpenHarness> {
  return openGameHarness(PONG_SYSTEM, testId, options);
}
