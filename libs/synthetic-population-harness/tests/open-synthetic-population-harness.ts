import { gameSystem } from '@libs/game-session-harness/game-system';
import { HARNESS_GAMES } from '@libs/games-harness/harness-games';
import type { OpenHarnessOptions } from '@libs/harness/mode';
import { openHarness as openSystemHarness } from '@libs/harness/open-harness';
import { SYNTHETIC_POPULATION_HARNESS_SLICE } from '@libs/synthetic-population-harness/synthetic-population-harness-slice';

/** Synthetic users play every registered game, as production offers them. */
const SYNTHETIC_POPULATION_SYSTEM = gameSystem(
  'synthetic-population',
  HARNESS_GAMES,
  {
    beside: [SYNTHETIC_POPULATION_HARNESS_SLICE],
    product: {
      secretValues: {
        POPULATION_WORKER_TOKEN:
          'synthetic-population-spec-worker-token-0123456789abcdef',
      },
    },
  }
);

export function openHarness(testId: string, options?: OpenHarnessOptions) {
  return openSystemHarness(SYNTHETIC_POPULATION_SYSTEM, testId, options);
}
