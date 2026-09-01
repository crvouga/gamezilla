import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createSimClock, SimDb } from '../../sim';
import {
  faultScheduleFromSeed,
  runHarness,
} from '../../sim/harness';

const SEEDS_PATH = join(import.meta.dir, 'known-seeds.txt');

function loadKnownSeeds(): number[] {
  const env = process.env['INDEXES_SIM_SEED'];
  if (env !== undefined && env.length > 0) {
    return [Number(env)];
  }
  return readFileSync(SEEDS_PATH, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'))
    .map((l) => Number(l))
    .filter((n) => Number.isFinite(n));
}

describe('known-seeds corpus', () => {
  const seeds = loadKnownSeeds();

  test(`runs ${String(seeds.length)} committed seeds with zero violations`, async () => {
    expect(seeds.length).toBeGreaterThan(0);
    for (const seed of seeds) {
      const clock = createSimClock(0);
      const db = new SimDb({
        clock,
        tables: [
          { name: 'notes', estimatedRows: 50_000 },
          { name: 'users', estimatedRows: 50_000 },
        ],
        defaultImprovement: 10,
        faults: faultScheduleFromSeed(seed),
      });
      const result = await runHarness({
        seed,
        db,
        clock,
        tables: ['notes', 'users'],
        cycles: 4,
      });
      expect(result.violations).toEqual([]);
    }
  });
});
