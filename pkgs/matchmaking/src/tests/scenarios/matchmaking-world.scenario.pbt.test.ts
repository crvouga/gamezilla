import { afterAll, beforeAll, describe, test } from 'bun:test';
import { check } from '@pkgs/dst/pbt';

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
    'check explores knobs + tick/advance library',
    async () => {
      await check(
        MATCHMAKING_SYSTEM as unknown as Parameters<typeof check>[0],
        { episodeLength: 6, episodes: 2 }
      );
    },
    { timeout: 120_000 }
  );
});
