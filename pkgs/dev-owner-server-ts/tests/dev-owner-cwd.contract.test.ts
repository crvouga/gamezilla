import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gcDevOwner } from '@pkgs/dev-owner-server-ts/dev-owner-gc';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';

// regression: owned-command-package-cwd
test('owned package command resolves its relative Storybook configuration after reexec', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'owned-package-cwd-')));
  const cwd = join(root, 'pkgs/ui-root-harness-ts');
  mkdirSync(join(cwd, 'storybook'), { recursive: true });
  writeFileSync(
    join(cwd, 'storybook/main.cjs'),
    'module.exports = "storybook-config-found";'
  );
  try {
    const result = spawnSync(
      process.execPath,
      [join(import.meta.dirname, 'dev-owner-cwd-fixture.ts'), root],
      {
        cwd,
        encoding: 'utf8',
        timeout: 30000,
        env: { ...process.env, DEV_OWNER_ROOT: '', DEV_OWNER_BOOT: '' },
      }
    );
    expect(result.stderr).not.toContain('MODULE_NOT_FOUND');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('storybook-config-found');
  } finally {
    await gcDevOwner(root, true);
    removeTree(root, { whenLocked: 'leave' });
  }
}, 40000);
