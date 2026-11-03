// @io-wall-ok — export reviewed browser references from an isolated CI checkout.
import { execFileSync } from 'node:child_process';
import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { decodeBaselineLog, encodeBaselineLog } from './storybook-baseline-log';

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
  const patch = join(root, '.cache/verify-nightly/storybook-baselines.patch');
  const decode = process.argv.indexOf('--decode-log');
  if (decode >= 0) {
    const source = process.argv[decode + 1];
    if (!source)
      throw new Error('--decode-log requires the downloaded job log');
    mkdirSync(dirname(patch), { recursive: true });
    writeFileSync(patch, decodeBaselineLog(readFileSync(source, 'utf8')));
    console.log(`wrote ${patch}`);
  } else {
    writeBaselinePatch(root, patch);
    if (process.argv.includes('--stdout')) {
      console.log('STORYBOOK_BASELINES_PATCH_BEGIN');
      console.log(encodeBaselineLog(readFileSync(patch, 'utf8')));
      console.log('STORYBOOK_BASELINES_PATCH_END');
    }
  }
}
