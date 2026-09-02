import { afterAll, beforeAll, describe, test } from 'bun:test';
import { runScenario } from '@pkgs/determinism/pbt';

import { MATCHMAKING_SYSTEM } from '../../sim/scenario';
import { registerTestCrashHandler } from '../fixtures';

describe('matchmaking world system PBT', () => {
  let disposeCrash: () => void;
  beforeAll(() => {
    disposeCrash = registerTestCrashHandler();
  });
  afterAll(() => {
    disposeCrash();
  });

  test(
    'runScenario explores knobs + tick/advance library',
    async () => {
      await runScenario(
        MATCHMAKING_SYSTEM as unknown as Parameters<typeof runScenario>[0],
        { maxCommands: 6, numRuns: 2 }
      );
    },
    { timeout: 120_000 }
  );
});
