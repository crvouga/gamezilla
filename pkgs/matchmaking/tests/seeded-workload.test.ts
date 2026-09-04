import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import {
  join,
  matchFingerprint,
  matchmaking,
  RatingAttr,
  registerTestCrashHandler,
  replicaIds,
  tick,
} from '@pkgs/matchmaking/sim';
import { createSeededRng } from '@pkgs/uuid';

const SimpleFormula = { numeric: [{ tag: RatingAttr, weight: 1 }] };

async function runWorkload(seed: string): Promise<string> {
  await using s = await matchmaking.run({
    seed: seed,
    args: { replicas: 3 },
  });
  const replicas = await s.read(replicaIds);
  const rng = createSeededRng(seed).fork('workload');
  for (let i = 0; i < 10; i += 1) {
    await s.advanceTime(1);
    await s.apply(join, {
      ref: `p${String(i)}`,
      input: {
        data: RatingAttr(1000 + rng.int(50)),
        formulas: [SimpleFormula],
      },
      replicaId: replicas[i % replicas.length]!,
    });
    if (i % 3 === 2) {
      await s.apply(tick, {
        opts: { maxPassesPerPartition: 2 },
        replicaId: replicas[(i + 1) % replicas.length]!,
      });
    }
  }
  for (const replicaId of replicas) {
    await s.apply(tick, { opts: { maxPassesPerPartition: 8 }, replicaId });
  }
  return await matchFingerprint(s);
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
