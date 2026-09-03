import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import type { TickResult } from '../../interface/matchmaking';
import type { StatusResult } from '../../interface/types';
import {
  join,
  lastTick,
  participantIds,
  statusOf,
  tick,
  matchmaking,
  matchmakingKnobs,
  MATCHMAKING_PROPERTIES,
  defineMatchmakingSystem,
} from '../../sim/scenario';
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
    await using run = await script(defineMatchmakingSystem({ schema: { partitionKeys: [KindAttr.key] } }), {
      seed: 40,
      knobs: matchmakingKnobs(),
      properties: MATCHMAKING_PROPERTIES,
    });
    const plan = [
      { ref: 'a1', rating: 1000, kind: 'alpha' },
      { ref: 'a2', rating: 1010, kind: 'alpha' },
      { ref: 'b1', rating: 1000, kind: 'beta' },
      { ref: 'b2', rating: 1010, kind: 'beta' },
    ];
    for (const { ref, rating, kind } of plan) {
      await run.apply(join, {
        ref,
        input: {
          data: { ...RatingAttr(rating), ...KindAttr(kind) },
          formulas: [SimpleFormula],
        },
      });
    }
    await run.apply(tick, { opts: { maxPassesPerPartition: 8 } });
    const drained = (await run.observe(lastTick)) as TickResult;
    expect(drained.matches).toBe(2);
    expect(drained.partitions).toBe(2);
    const ids = await run.observe(participantIds);
    const a1 = expectMatched(
      (await run.observe(statusOf, 'a1')) as StatusResult
    );
    expect(a1.peers[0]?.participantId).toBe(ids['a2']);
    const b1 = expectMatched(
      (await run.observe(statusOf, 'b1')) as StatusResult
    );
    expect(b1.peers[0]?.participantId).toBe(ids['b2']);
  });
});
