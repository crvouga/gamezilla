import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const runScript = join(import.meta.dirname, '../workspace/run.sh');

function run() {
  const dir = mkdtempSync(join(tmpdir(), 'workspace-run-'));
  const calls = join(dir, 'calls');
  try {
    writeFileSync(
      join(dir, 'bun'),
      '#!/usr/bin/env bash\n' +
        'printf "%s\\n" "$*" >> "$WORKSPACE_RUN_TEST_CALLS"\n',
      { mode: 0o755 }
    );
    const result = spawnSync('bash', [runScript], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${dir}:${process.env['PATH'] ?? ''}`,
        VITE_PORT: '5800',
        WORKSPACE_RUN_TEST_CALLS: calls,
      },
    });
    return { ...result, calls: readFileSync(calls, 'utf8').trim().split('\n') };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// regression: workspace-run-preflight-dependency-failure
test('Run launches dev directly on the workspace port', () => {
  const result = run();
  expect(result.status).toBe(0);
  expect(result.calls).toEqual(['run --silent dev -- --web-port 5800']);
});
