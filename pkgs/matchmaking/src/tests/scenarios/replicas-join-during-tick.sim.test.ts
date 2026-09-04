import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import {
  type JoinSpec,
  join,
  joinsDuringTick,
  matchmaking,
  participantIds,
  tickAllWith,
} from '../../sim/scenario';
import {
  assertMatchInvariants,
  RatingAttr,
  registerTestCrashHandler,
} from '../fixtures';

const SimpleFormula = { numeric: [{ tag: RatingAttr, weight: 1 }] };

function lateJoins(): JoinSpec[] {
  return Array.from({ length: 4 }, (_, i) => ({
    ref: `late${String(i)}`,
    input: { data: RatingAttr(1200 + i), formulas: [SimpleFormula] },
    replicaId: i % 2 === 0 ? 'r0' : 'r1',
  }));
}

describe('matchmaking sim: join during tick', () => {
  let disposeCrash: () => void;
  beforeAll(() => {
    disposeCrash = registerTestCrashHandler();
  });
  afterAll(() => {
    disposeCrash();
  });

  test('joins on r0/r1 while r2 ticks; settle with tickAll', async () => {
    await using s = await matchmaking.script({
      seed: 230,
      args: { replicas: 3, backend: 'postgres' },
    });
    for (let i = 0; i < 4; i += 1) {
      await s.elapse(1);
      await s.apply(join, {
        ref: `warm${String(i)}`,
        input: { data: RatingAttr(1100 + i), formulas: [SimpleFormula] },
      });
    }
    await s.apply(joinsDuringTick, {
      tickReplicaId: 'r2',
      tickOpts: { maxPassesPerPartition: 4 },
      joins: lateJoins(),
      gapMs: 1,
    });
    await s.apply(tickAllWith, { maxPassesPerPartition: 8 });
    const ids = Object.values(await s.observe(participantIds));
    const { matchCount, waiting } = await assertMatchInvariants(s, ids);
    expect(matchCount * 2 + waiting).toBe(ids.length);
  });
});
