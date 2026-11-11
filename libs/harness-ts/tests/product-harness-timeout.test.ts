// @io-wall-ok — a fixture suite run by a real `bun test` subprocess.
import { afterAll, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';

const ROOT = mkdtempSync(join(tmpdir(), 'harness-timeout-'));
const REPO = join(import.meta.dir, '../../..');

afterAll(() => {
  removeTree(ROOT, { whenLocked: 'leave' });
});

// Measured: the fixture's 5.1 s sleep plus a 0.6–2 s preload boot.
const FIXTURE_RUN_TIMEOUT_MS = 30_000;

// regression: harness-package-tests-default-five-second-timeout
// Literal failure: under `verify:coverage`, Battleship's own setup-adapter
// test opened a product world (4.5–5.0 s) under bun's 5 s default and timed
// out; only `test-spec.ts` passed the product-harness wall clock.
test(
  "a package's own harness test runs under the product-harness wall clock",
  () => {
    const fixture = join(ROOT, 'slow-world.test.ts');
    writeFileSync(
      fixture,
      `import { test } from 'bun:test';\n` +
        `test('a world past five seconds', () => Bun.sleep(5_100));\n`,
      'utf8'
    );
    // The same command line as a harness package's `test` script.
    const run = spawnSync(
      'bun',
      [
        'test',
        '--tsconfig-override',
        join(REPO, 'tsconfig.json'),
        '--conditions=browser',
        '--conditions=development',
        '--preload',
        join(REPO, 'pkgs/bun-test-solid-client-ts/src/preload.ts'),
        '--preload',
        join(REPO, 'libs/harness-ts/src/preload.ts'),
        fixture,
      ],
      { cwd: ROOT, encoding: 'utf8' }
    );
    expect(run.status, `${run.stdout}${run.stderr}`).toBe(0);
  },
  FIXTURE_RUN_TIMEOUT_MS
);
