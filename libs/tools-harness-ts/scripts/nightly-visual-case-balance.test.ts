import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';

const root = join(import.meta.dirname, '../../..');
const ui = join(root, 'pkgs/ui-root-harness-ts');
const workflow = Bun.YAML.parse(
  readFileSync(join(root, '.github/workflows/verify-nightly.yml'), 'utf8')
) as {
  jobs: Record<
    string,
    {
      env: { PWTEST_SHARD_WEIGHTS: string };
      strategy: { matrix: { shard: number[] } };
    }
  >;
};

function collected(dir: string, shard: number, weights: string) {
  const result = Bun.spawnSync(
    [
      'node',
      join(ui, 'node_modules/@playwright/test/cli.js'),
      'test',
      '--list',
      '--fully-parallel',
      `--shard=${shard}/8`,
    ],
    { cwd: dir, env: { ...process.env, PWTEST_SHARD_WEIGHTS: weights } }
  );
  expect(result.exitCode, result.stderr.toString()).toBe(0);
  return Array.from(result.stdout.toString().matchAll(/case (\d+)$/gm), (m) =>
    Number(m[1])
  );
}

// regression: nightly-visual-end-shards-outlast-guard
test('all eight jobs use the same Playwright allocation with smaller end partitions', () => {
  const allocations = new Map<number, string>();
  for (const [id, job] of Object.entries(workflow.jobs)) {
    if (!id.startsWith('verify-nightly-visual')) continue;
    for (const shard of job.strategy.matrix.shard)
      allocations.set(shard, job.env.PWTEST_SHARD_WEIGHTS);
  }
  expect([...allocations.keys()].sort((a, b) => a - b)).toEqual([
    1, 2, 3, 4, 5, 6, 7, 8,
  ]);
  expect(new Set(allocations.values()).size).toBe(1);
  const weights = allocations.get(1)!;
  const shares = weights.split(':').map(Number);
  expect(shares).toHaveLength(8);
  expect(shares.every((n) => Number.isSafeInteger(n) && n > 0)).toBe(true);
  const average = shares.reduce((sum, value) => sum + value, 0) / 8;
  expect(shares[4]! + shares[6]!).toBeLessThan(2 * average);
  const cache = join(ui, '.cache');
  mkdirSync(cache, { recursive: true });
  const dir = mkdtempSync(join(cache, 'visual-shard-contract-'));
  try {
    // One case per 87 from the 6,960-case census. Discovery never starts a browser.
    const total = 80;
    writeFileSync(
      join(dir, 'inventory.spec.ts'),
      `import { test } from '@playwright/test';
       for (let i = 0; i < ${total}; i++) test('case ' + i, () => {});`
    );
    const first = collected(dir, 1, weights);
    const last = collected(dir, 8, weights);
    expect(first[0]).toBe(0);
    expect(last.at(-1)).toBe(total - 1);
    expect(first.length).toBeLessThan(total / 8);
    expect(last.length).toBeLessThan(total / 8);
  } finally {
    removeTree(dir, { whenLocked: 'leave' });
  }
});
