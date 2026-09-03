import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/pbt';
import { createSeededRng } from '@pkgs/uuid';

import {
  join,
  passTime,
  replicaIds,
  startMatchmaking,
  tick,
} from '../../sim/scenario';
import {
  matchFingerprint,
  RatingAttr,
  registerTestCrashHandler,
} from '../fixtures';

const SimpleFormula = { numeric: [{ tag: RatingAttr, weight: 1 }] };

async function runShortWorkload(seed: string): Promise<string> {
  await using run = await startMatchmaking({ seed, replicas: 2 });
  const replicas = await run.observe(replicaIds);
  const rng = createSeededRng(seed).fork('workload');
  for (let i = 0; i < 6; i += 1) {
    const replicaId = replicas[i % replicas.length]!;
    await run.apply(passTime, 1);
    await run.apply(join, {
      ref: `p${String(i)}`,
      input: {
        data: RatingAttr(1000 + rng.int(50)),
        formulas: [SimpleFormula],
      },
      replicaId,
    });
    if (i % 2 === 1) {
      await run.apply(tick, {
        opts: { maxPassesPerPartition: 2 },
        replicaId,
      });
    }
  }
  for (const replicaId of replicas) {
    await run.apply(tick, { opts: { maxPassesPerPartition: 4 }, replicaId });
  }
  return await matchFingerprint(run);
}

describe('matchmaking seeded-workload PBT', () => {
  let disposeCrash: () => void;
  beforeAll(() => {
    disposeCrash = registerTestCrashHandler();
  });
  afterAll(() => {
    disposeCrash();
  });

  test('same generated seed → identical match fingerprint', async () => {
    await assertProperty(
      'matchmaking workload determinism',
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10_000 }).map(String),
        async (seed) => {
          const once = await runShortWorkload(seed);
          const twice = await runShortWorkload(seed);
          expect(once).toBe(twice);
        }
      ),
      { numRuns: 4 }
    );
  }, 120_000);
});
