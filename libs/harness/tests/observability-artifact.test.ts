// @io-wall-ok — failure-fixture subprocess and temporary artifact inspection.
import { afterAll, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = mkdtempSync(join(tmpdir(), 'harness-observability-'));

afterAll(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

test('an ordinary failing spec is queryable by its exact test name', () => {
  const fixture = join(ROOT, 'failure.test.ts');
  const artifactDir = join(ROOT, '.cache/harness-report/traces');
  const runner = join(import.meta.dir, '../scripts/test-spec.ts');
  const obsCli = join(
    import.meta.dir,
    '../../../pkgs/observability-cli/src/cli-io.ts'
  );
  writeFileSync(
    fixture,
    `import { expect, test } from 'bun:test';\n` +
      `test('deliberate failure', () => {\n` +
      `  expect(true).toBe(false);\n` +
      `});\n`,
    'utf8'
  );
  const run = spawnSync('bun', ['run', runner, fixture], {
    cwd: ROOT,
    env: { ...process.env, npm_package_name: '@fixtures/failing-spec' },
    encoding: 'utf8',
  });
  expect(run.status).not.toBe(0);
  const artifact = join(artifactDir, 'spans.ndjson');
  expect(existsSync(artifact)).toBe(true);
  const artifactText = readFileSync(artifact, 'utf8');
  expect(artifactText).toContain('deliberate failure');
  const query = spawnSync(
    'bun',
    [
      'run',
      obsCli,
      'test',
      'deliberate failure',
      '--source',
      artifactDir,
      '--last-failure',
    ],
    { cwd: ROOT, encoding: 'utf8' }
  );
  expect(query.status).toBe(0);
  expect(query.stdout).toContain('test.failure [ERROR]');
  expect(query.stdout).toContain('app.test.id=deliberate failure');
  expect(query.stdout).toContain('next: bun obs span');
});
