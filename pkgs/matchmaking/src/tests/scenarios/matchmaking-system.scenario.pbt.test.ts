import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

import { matchmaking } from '../../sim/scenario';
import { registerTestCrashHandler } from '../fixtures';

describe('matchmaking system PBT', () => {
  let disposeCrash: () => void;
  beforeAll(() => {
    disposeCrash = registerTestCrashHandler();
  });
  afterAll(() => {
    disposeCrash();
  });

  test(
    'explore draws replica topology + walks the registered pool',
    async () => {
      const report = await matchmaking.explore({
        time: { weight: 1, minMs: 0, maxMs: 5_000 },
        episodes: 2,
        steps: 6,
        seed: 1,
        stopOnViolation: true,
      });
      expect(report.ok).toBe(true);
    },
    { timeout: 120_000 }
  );
});
