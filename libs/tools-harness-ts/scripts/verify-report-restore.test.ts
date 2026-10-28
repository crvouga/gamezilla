import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { removeTree } from '@pkgs/os-server-ts/remove-tree';
import { reportOutputPath } from './verify-report-evidence';
import { restoreReportOutputs } from './verify-report-restore';

// regression: reports-ci-aggregation-disk
test('cached sources publish and release separately, including a publication failure', async () => {
  const fixture = mkdtempSync(join(tmpdir(), 'report-restore-'));
  const root = join(fixture, 'destination');
  const ids = Array.from(
    { length: 9 },
    (_, index) => `@apps/product-ts#test:spec:${index}`
  );
  const files = ids.map((id) => `${reportOutputPath(id)}/complete.json`);
  const unrelated = 'apps/product-ts/.cache/large-unrelated-output';
  try {
    for (const file of [...files, unrelated]) {
      mkdirSync(dirname(join(fixture, file)), { recursive: true });
      writeFileSync(join(fixture, file), '{"status":0}');
    }
    // Turbo can pack file entries without explicit directory headers.
    const archive = join(fixture, 'cached.tar');
    // Relative names: GNU tar (Git Bash on Windows) misreads `C:\…` paths.
    expect(
      spawnSync('tar', ['-cf', 'cached.tar', ...files, unrelated], {
        cwd: fixture,
      }).status
    ).toBe(0);
    const compressed = Bun.zstdCompressSync(readFileSync(archive));
    mkdirSync(root);
    const attempted: string[] = [];
    let peak = 0;
    const request = async () => new Response(new Uint8Array(compressed));
    let verdict: unknown;
    try {
      await restoreReportOutputs({
        ids,
        root,
        request,
        env: {
          TURBO_API: 'https://cache.invalid',
          TURBO_TEAM: 'team',
          TURBO_TOKEN: 'token',
        },
        plan: {
          tasks: ids.map((taskId, index) => ({
            taskId,
            hash: String(index).repeat(16),
          })),
        },
        publish: async (id) => {
          attempted.push(id);
          const live = ids.filter((other) =>
            existsSync(join(root, reportOutputPath(other)))
          ).length;
          peak = Math.max(peak, live);
          expect(live).toBeLessThanOrEqual(4);
          expect(
            existsSync(join(root, reportOutputPath(id), 'complete.json'))
          ).toBe(true);
          expect(existsSync(join(root, unrelated))).toBe(false);
          await Promise.resolve();
          if (id === ids[0]) throw new Error('publication unavailable');
        },
      });
    } catch (error) {
      verdict = error;
    }
    expect(attempted).toEqual(ids);
    expect(peak).toBeGreaterThan(1);
    expect(verdict).toBeInstanceOf(AggregateError);
    expect((verdict as AggregateError).errors).toHaveLength(1);
    for (const id of ids)
      expect(existsSync(join(root, reportOutputPath(id)))).toBe(false);
  } finally {
    removeTree(fixture, { whenLocked: 'leave' });
  }
});
