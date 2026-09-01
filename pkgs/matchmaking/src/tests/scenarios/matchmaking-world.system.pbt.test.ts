import { afterAll, beforeAll, describe, test } from 'bun:test';
import { assertSample } from '@pkgs/determinism/pbt';

import { MATCHMAKING_SYSTEM } from '../../sim/system';
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
    'assertSample explores knobs + tick/advance library',
    async () => {
      await assertSample(MATCHMAKING_SYSTEM, { maxCommands: 6, numRuns: 2 });
    },
    { timeout: 120_000 }
  );
});
