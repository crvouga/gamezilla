import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { explore } from '@pkgs/dst';
import { INDEXES_ACTIONS, INDEXES_PROPERTIES, indexes } from './system';

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

  test(`check ${String(seeds.length)} committed seeds with zero violations`, async () => {
    expect(seeds.length).toBeGreaterThan(0);
    for (const seed of seeds) {
      const report = await explore(indexes, {
        properties: INDEXES_PROPERTIES,
        actions: INDEXES_ACTIONS,
        episodes: 1,
        steps: 8,
        seed,
        stopOnViolation: true,
      });
      expect(report.ok).toBe(true);
    }
  }, 300_000);
});
