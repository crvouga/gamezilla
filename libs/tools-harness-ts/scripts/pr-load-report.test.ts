// @io-wall-ok — exercise the public diagnostic CLI against disposable Git history.
import { expect, test } from 'bun:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';

// regression: throughput-sweep-sampled-only-ninety
test('a requested 100-job burst refuses a history window of only 90 revisions', () => {
  const cache = join(import.meta.dirname, '../../../.cache');
  mkdirSync(cache, { recursive: true });
  const cwd = mkdtempSync(join(cache, 'pr-load-test-'));
  try {
    execFileSync('git', ['init', '--quiet'], { cwd });
    const commits = Array.from(
      { length: 90 },
      (_, index) =>
        `commit refs/remotes/origin/main\ncommitter Fixture <fixture@example.invalid> ${1000000000 + index} +0000\ndata 1\nx\n\n`
    );
    execFileSync('git', ['fast-import', '--quiet'], {
      cwd,
      input: commits.join(''),
    });
    const actual = spawnSync(
      Bun.which('python3') ?? 'python',
      [join(import.meta.dirname, 'pr-load-report.py'), 'dispatch', '100'],
      { cwd, encoding: 'utf8' }
    );
    expect(actual.status).toBe(1);
    expect(actual.stderr).toContain(
      'Requested 100 distinct revisions; found 90'
    );
  } finally {
    removeTree(cwd, { whenLocked: 'leave' });
  }
});
