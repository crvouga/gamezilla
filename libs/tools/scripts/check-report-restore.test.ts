import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { reportOutputPath } from './check-report-evidence';
import { restoreReportOutputs } from './check-report-restore';

// regression: reports-ci-aggregation-disk
test('cached sources publish and release separately, including a publication failure', async () => {
  const fixture = mkdtempSync(join(tmpdir(), 'report-restore-'));
  const root = join(fixture, 'destination');
  const ids = ['@apps/product#test:spec:0', '@apps/product#test:spec:1'];
  const files = ids.map((id) => `${reportOutputPath(id)}/complete.json`);
  const unrelated = 'apps/product/.cache/large-unrelated-output';
  try {
    for (const file of [...files, unrelated]) {
      mkdirSync(dirname(join(fixture, file)), { recursive: true });
      writeFileSync(join(fixture, file), '{"status":0}');
    }
    // Turbo can pack file entries without explicit directory headers.
    const archive = join(fixture, 'cached.tar');
    expect(
      spawnSync('tar', ['-cf', archive, '-C', fixture, ...files, unrelated])
        .status
    ).toBe(0);
    const compressed = Bun.zstdCompressSync(readFileSync(archive));
    mkdirSync(root);
    const attempted: string[] = [];
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
          expect(
            existsSync(join(root, reportOutputPath(id), 'complete.json'))
          ).toBe(true);
          expect(
            existsSync(
              join(root, reportOutputPath(ids.find((other) => other !== id)!))
            )
          ).toBe(false);
          expect(existsSync(join(root, unrelated))).toBe(false);
          if (id === ids[0]) throw new Error('publication unavailable');
        },
      });
    } catch (error) {
      verdict = error;
    }
    expect(attempted).toEqual(ids);
    expect(verdict).toBeInstanceOf(AggregateError);
    expect((verdict as AggregateError).errors).toHaveLength(1);
    for (const id of ids)
      expect(existsSync(join(root, reportOutputPath(id)))).toBe(false);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
