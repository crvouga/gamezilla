import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const runScript = join(import.meta.dirname, '../workspace/run.sh');

function run(checkExit: number) {
  const dir = mkdtempSync(join(tmpdir(), 'workspace-run-'));
  const calls = join(dir, 'calls');
  try {
    writeFileSync(
      join(dir, 'bun'),
      '#!/usr/bin/env bash\n' +
        'printf "%s\\n" "$*" >> "$WORKSPACE_RUN_TEST_CALLS"\n' +
        'if [ "$*" = "run --silent --filter @libs/runtime-server test:contract" ]; then\n' +
        '  exit "$WORKSPACE_RUN_TEST_CHECK_EXIT"\n' +
        'fi\n',
      { mode: 0o755 }
    );
    const result = spawnSync('bash', [runScript], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${dir}:${process.env['PATH'] ?? ''}`,
        VITE_PORT: '5800',
        WORKSPACE_RUN_TEST_CALLS: calls,
        WORKSPACE_RUN_TEST_CHECK_EXIT: String(checkExit),
      },
    });
    return { ...result, calls: readFileSync(calls, 'utf8').trim().split('\n') };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// regression: workspace-run-launches-unsupported-mockingbird-postgres
test('Run stops before launching dev when application reconciliation fails', () => {
  const result = run(7);
  expect(result.status).toBe(1);
  expect(result.calls).toEqual([
    'run --silent --filter @libs/runtime-server test:contract',
  ]);
  expect(result.stderr).toContain(
    'Mockingbird Postgres cannot reconcile the application schema'
  );
  expect(result.stderr).toContain('libs/tools/MOCKINGBIRD_MIGRATION.md');
});

test('Run launches dev on the workspace port after the reconciliation check passes', () => {
  const result = run(0);
  expect(result.status).toBe(0);
  expect(result.calls).toEqual([
    'run --silent --filter @libs/runtime-server test:contract',
    'run --silent dev -- --web-port 5800',
  ]);
});
