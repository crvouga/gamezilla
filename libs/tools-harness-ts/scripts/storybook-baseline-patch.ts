// @io-wall-ok — export reviewed browser references from an isolated CI checkout.
import { execFileSync } from 'node:child_process';
import { closeSync, mkdirSync, openSync } from 'node:fs';
import { dirname, join } from 'node:path';

const BASELINES = ':(glob)pkgs/*/src/**/baselines/chromium/**';

/** Include new PNGs while preserving modified and deleted reference diffs. */
export function writeBaselinePatch(root: string, patch: string): void {
  const added = execFileSync(
    'git',
    ['ls-files', '--others', '--exclude-standard', '-z', '--', BASELINES],
    { cwd: root }
  );
  if (added.length)
    execFileSync(
      'git',
      [
        '--literal-pathspecs',
        'add',
        '--intent-to-add',
        '--pathspec-from-file=-',
        '--pathspec-file-nul',
      ],
      { cwd: root, input: added }
    );
  mkdirSync(dirname(patch), { recursive: true });
  const output = openSync(patch, 'w');
  try {
    execFileSync('git', ['diff', '--binary', '--', BASELINES], {
      cwd: root,
      stdio: ['ignore', output, 'pipe'],
    });
  } finally {
    closeSync(output);
  }
}

if (import.meta.main) {
  const root = join(import.meta.dirname, '../../..');
  writeBaselinePatch(
    root,
    join(root, '.cache/verify-nightly/storybook-baselines.patch')
  );
}
