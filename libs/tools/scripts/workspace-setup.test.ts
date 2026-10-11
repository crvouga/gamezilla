import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const hooks = join(import.meta.dirname, '../workspace');

// regression: workspace-setup-uninitialized-submodule
test('workspace setup initializes submodule workspaces before installing', () => {
  // A throwaway checkout holding the real hooks: nothing here has installed
  // turbo yet, so setup runs its steps itself.
  const dir = mkdtempSync(join(tmpdir(), 'workspace-setup-'));
  const calls = join(dir, '.calls');
  try {
    cpSync(hooks, join(dir, 'libs/tools/workspace'), { recursive: true });
    mkdirSync(join(dir, '.bin'));
    writeFileSync(join(dir, 'package.json'), '{"name":"root"}\n');
    writeFileSync(join(dir, 'bun.lock'), '{}\n');
    writeFileSync(
      join(dir, '.bin/git'),
      '#!/usr/bin/env bash\n' +
        'printf "git %s\\n" "$*" >> "$WORKSPACE_SETUP_TEST_CALLS"\n' +
        'if [ "$*" = "config --get core.hooksPath" ]; then\n' +
        '  printf "libs/tools/githooks\\n"\n' +
        'fi\n',
      { mode: 0o755 }
    );
    writeFileSync(
      join(dir, '.bin/bun'),
      '#!/usr/bin/env bash\n' +
        'printf "bun %s\\n" "$*" >> "$WORKSPACE_SETUP_TEST_CALLS"\n' +
        'if [ "$1" = "install" ]; then exit 1; fi\n',
      { mode: 0o755 }
    );
    writeFileSync(join(dir, '.bin/mise'), '#!/usr/bin/env bash\nexit 0\n', {
      mode: 0o755,
    });

    const result = spawnSync(
      'bash',
      [join(dir, 'libs/tools/workspace/setup.sh')],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${join(dir, '.bin')}:${process.env['PATH'] ?? ''}`,
          WORKSPACE_SETUP_TEST_CALLS: calls,
        },
      }
    );
    const invoked = readFileSync(calls, 'utf8').trim().split('\n');
    const submodule = invoked.indexOf(
      'git submodule update --init --recursive'
    );
    const install = invoked.indexOf('bun install');

    expect(result.status).toBe(0);
    expect(submodule).toBeGreaterThan(-1);
    expect(install).toBeGreaterThan(-1);
    expect(submodule).toBeLessThan(install);
    expect(invoked).toContain('bun install --ignore-scripts');
    // A step that failed prints what it did; the others stay one line each.
    expect(result.stdout).toContain('dependency install is still incomplete');
    expect(result.stdout).toContain('!!! workspace:install is unfinished');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
