import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { openMatchmakingWorld } from '../../sim/system';
import {
  expectMatched,
  RatingAttr,
  registerTestCrashHandler,
} from '../fixtures';

const SimpleFormula = { numeric: [{ tag: RatingAttr, weight: 1 }] };

describe('matchmaking sim: priority', () => {
  let disposeCrash: () => void;
  beforeAll(() => {
    disposeCrash = registerTestCrashHandler();
  });
  afterAll(() => {
    disposeCrash();
  });

  test('high-priority joiner is matched before same-bucket FIFO peer', async () => {
    await using world = await openMatchmakingWorld({ seed: 80 });
    const a = await world.join({
      data: RatingAttr(1000),
      formulas: [
        {
          numeric: [{ tag: RatingAttr, weight: 1 }],
          radius: {
            baseRadius: 0,
            radiusGrowthPerSecond: 0,
            maxRadius: 0,
          },
        },
      ],
    });
    world.clock.advance(1);
    const b = await world.join({
      data: RatingAttr(1005),
      formulas: [SimpleFormula],
      priority: 100,
    });
    world.clock.advance(1);
    const c = await world.join({
      data: RatingAttr(1010),
      formulas: [SimpleFormula],
    });
    expect((await world.tick({ maxPassesPerPartition: 1 })).matches).toBe(1);
    expect(expectMatched(await b.status()).peers[0]?.participantId).toBe(
      c.participantId
    );
    expect((await a.status())?.status).toBe('waiting');
  });
});
