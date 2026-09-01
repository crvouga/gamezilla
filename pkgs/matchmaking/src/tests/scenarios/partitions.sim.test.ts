import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { openMatchmakingWorld } from '../../sim/system';
import {
  expectMatched,
  KindAttr,
  RatingAttr,
  registerTestCrashHandler,
} from '../fixtures';

const SimpleFormula = { numeric: [{ tag: RatingAttr, weight: 1 }] };

describe('matchmaking sim: partitions', () => {
  let disposeCrash: () => void;
  beforeAll(() => {
    disposeCrash = registerTestCrashHandler();
  });
  afterAll(() => {
    disposeCrash();
  });

  test('declared partitionKeys isolate participants across shards', async () => {
    await using host = await openMatchmakingWorld({
      seed: 40,
      schema: { partitionKeys: [KindAttr.key] },
    });
    const world = host.facade;
    const formulas = [SimpleFormula];
    const a1 = await world.join({
      data: { ...RatingAttr(1000), ...KindAttr('alpha') },
      formulas,
    });
    const a2 = await world.join({
      data: { ...RatingAttr(1010), ...KindAttr('alpha') },
      formulas,
    });
    const b1 = await world.join({
      data: { ...RatingAttr(1000), ...KindAttr('beta') },
      formulas,
    });
    const b2 = await world.join({
      data: { ...RatingAttr(1010), ...KindAttr('beta') },
      formulas,
    });
    const drained = await world.tick({ maxPassesPerPartition: 8 });
    expect(drained.matches).toBe(2);
    expect(drained.partitions).toBe(2);
    expect(expectMatched(await a1.status()).peers[0]?.participantId).toBe(
      a2.participantId
    );
    expect(expectMatched(await b1.status()).peers[0]?.participantId).toBe(
      b2.participantId
    );
  });
});
