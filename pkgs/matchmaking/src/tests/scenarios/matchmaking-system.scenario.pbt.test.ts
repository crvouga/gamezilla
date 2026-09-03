import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { explore } from '@pkgs/dst';

import {
  genMatchmakingKnobs,
  MATCHMAKING_ACTIONS,
  MATCHMAKING_PROPERTIES,
  MATCHMAKING_SYSTEM,
} from '../../sim/scenario';
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
    'check explores knobs + tick/advance library',
    async () => {
      const report = await explore(MATCHMAKING_SYSTEM, {
        properties: MATCHMAKING_PROPERTIES,
        actions: MATCHMAKING_ACTIONS,
        knobs: genMatchmakingKnobs(),
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
