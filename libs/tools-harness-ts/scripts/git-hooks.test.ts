import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const hooks = join(import.meta.dirname, '../workspace');
const REPO_ROOT = join(import.meta.dirname, '../../..');
/** Git's own hook filenames. A tracked file with one of these names is a hook. */
const GIT_HOOK_NAMES = new Set([
  'applypatch-msg',
  'commit-msg',
  'fsmonitor-watchman',
  'post-applypatch',
  'post-checkout',
  'post-commit',
  'post-merge',
  'post-rewrite',
  'post-update',
  'pre-applypatch',
  'pre-auto-gc',
  'pre-commit',
  'pre-merge-commit',
  'pre-push',
  'pre-rebase',
  'pre-receive',
  'prepare-commit-msg',
  'push-to-checkout',
  'reference-transaction',
  'sendemail-validate',
]);

test('the repository has no git hooks', () => {
  const listed = spawnSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { cwd: REPO_ROOT, encoding: 'utf8' }
  );
  expect(listed.status).toBe(0);
  const hits = listed.stdout.split('\0').filter((path) => {
    const name = path.split('/').at(-1) ?? '';
    return GIT_HOOK_NAMES.has(name) && existsSync(join(REPO_ROOT, path));
  });
  expect(hits).toEqual([]);
  const pkg = readFileSync(join(REPO_ROOT, 'package.json'), 'utf8');
  expect(pkg).not.toContain('hooks:install');
  expect(pkg).not.toContain('core.hooksPath');
  const step = readFileSync(join(hooks, 'step.sh'), 'utf8');
  expect(step).not.toContain('hooksPath');
  expect(step).not.toContain('githooks');
});
