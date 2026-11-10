import { gameSystem } from '@libs/game-session-harness-ts/game-system';
import { HARNESS_GAMES } from '@libs/games-harness-ts/harness-games';
import type { OpenHarnessOptions } from '@libs/harness-ts/mode';
import { openHarness as openSystemHarness } from '@libs/harness-ts/open-harness';
import { OBSERVATORY_HARNESS_SLICE } from '@libs/observatory-actions-harness-ts/observatory-harness-slice';
import { SYNTHETIC_POPULATION_HARNESS_SLICE } from '@libs/synthetic-population-harness-ts/synthetic-population-harness-slice';

/**
 * Whoever is online now, people and Synthetic Users playing every
 * registered game, as production runs them.
 */
const OBSERVATORY_SYSTEM = gameSystem('observatory', HARNESS_GAMES, {
  beside: [SYNTHETIC_POPULATION_HARNESS_SLICE, OBSERVATORY_HARNESS_SLICE],
  product: {
    secretValues: {
      POPULATION_WORKER_TOKEN:
        'synthetic-population-spec-worker-token-0123456789abcdef',
    },
  },
});

export function openHarness(testId: string, options?: OpenHarnessOptions) {
  return openSystemHarness(OBSERVATORY_SYSTEM, testId, options);
}
