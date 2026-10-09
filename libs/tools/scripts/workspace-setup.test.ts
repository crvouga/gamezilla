import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = join(import.meta.dirname, '../../..');
const setupScript = join(root, 'libs/tools/workspace/setup.sh');

// regression: workspace-setup-uninitialized-submodule
test('workspace setup initializes submodule workspaces before installing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'workspace-setup-'));
  const calls = join(dir, 'calls');
  try {
    writeFileSync(
      join(dir, 'git'),
      '#!/usr/bin/env bash\n' +
        'printf "git %s\\n" "$*" >> "$WORKSPACE_SETUP_TEST_CALLS"\n' +
        'if [ "$1" = "-C" ] && [ "$3" = "rev-parse" ]; then\n' +
        '  printf "%s/.git\\n" "$WORKSPACE_SETUP_TEST_ROOT"\n' +
        'elif [ "$*" = "config --get core.hooksPath" ]; then\n' +
        '  printf "libs/tools/githooks\\n"\n' +
        'fi\n',
      { mode: 0o755 }
    );
    writeFileSync(
      join(dir, 'bun'),
      '#!/usr/bin/env bash\n' +
        'printf "bun %s\\n" "$*" >> "$WORKSPACE_SETUP_TEST_CALLS"\n' +
        'if [ "$*" = "install" ]; then exit 1; fi\n' +
        'if [ "$*" = "install --ignore-scripts" ]; then exit 1; fi\n',
      { mode: 0o755 }
    );
    writeFileSync(join(dir, 'mise'), '#!/usr/bin/env bash\nexit 0\n', {
      mode: 0o755,
    });

    const result = spawnSync('bash', [setupScript], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${dir}:${process.env['PATH'] ?? ''}`,
        WORKSPACE_SETUP_TEST_CALLS: calls,
        WORKSPACE_SETUP_TEST_ROOT: root,
      },
    });
    const invoked = readFileSync(calls, 'utf8').trim().split('\n');
    const submodule = invoked.indexOf(
      'git submodule update --init --recursive'
    );
    const install = invoked.indexOf('bun install');

    expect(result.status).toBe(0);
    expect(submodule).toBeGreaterThan(-1);
    expect(submodule).toBeLessThan(install);
    expect(invoked).toContain('bun install --ignore-scripts');
    expect(result.stdout).toContain('dependency install is still incomplete');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
