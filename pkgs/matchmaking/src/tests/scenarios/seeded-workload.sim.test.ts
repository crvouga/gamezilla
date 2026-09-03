import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import { createSeededRng } from '@pkgs/uuid';
import {
  join,
  replicaIds,
  tick,
  matchmaking,
  matchmakingKnobs,
  MATCHMAKING_PROPERTIES,
} from '../../sim/scenario';
import {
  matchFingerprint,
  RatingAttr,
  registerTestCrashHandler,
} from '../fixtures';

const SimpleFormula = { numeric: [{ tag: RatingAttr, weight: 1 }] };

async function runWorkload(seed: string): Promise<string> {
  await using run = await script(matchmaking, {
      seed: seed,
      knobs: matchmakingKnobs({ replicas: 3 }),
      properties: MATCHMAKING_PROPERTIES,
    });
  const replicas = await run.observe(replicaIds);
  const rng = createSeededRng(seed).fork('workload');
  for (let i = 0; i < 10; i += 1) {
    await run.elapse(1);
    await run.apply(join, {
      ref: `p${String(i)}`,
      input: {
        data: RatingAttr(1000 + rng.int(50)),
        formulas: [SimpleFormula],
      },
      replicaId: replicas[i % replicas.length]!,
    });
    if (i % 3 === 2) {
      await run.apply(tick, {
        opts: { maxPassesPerPartition: 2 },
        replicaId: replicas[(i + 1) % replicas.length]!,
      });
    }
  }
  for (const replicaId of replicas) {
    await run.apply(tick, { opts: { maxPassesPerPartition: 8 }, replicaId });
  }
  return await matchFingerprint(run);
}

describe('matchmaking sim: seeded workload determinism', () => {
  let disposeCrash: () => void;
  beforeAll(() => {
    disposeCrash = registerTestCrashHandler();
  });
  afterAll(() => {
    disposeCrash();
  });

  test('same seed yields identical match fingerprint twice', async () => {
    const seed = process.env['SIM_SEED'] ?? '42';
    const once = await runWorkload(seed);
    const twice = await runWorkload(seed);
    expect(once).toBe(twice);
  });
});
