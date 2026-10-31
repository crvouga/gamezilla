import { expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import { writeBaselinePatch } from './storybook-baseline-patch';

// regression: storybook-baseline-patch-omits-new-files
test('a reference patch reproduces added, modified and deleted PNGs without unrelated files', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'storybook-patch-'));
  const source = join(fixture, 'source');
  const target = join(fixture, 'target');
  const slice =
    'pkgs/ui-root-client-ts/src/sparkline/baselines/chromium/primitives-sparkline';
  const old = Buffer.from([0, 1, 2]);
  const changed = Buffer.from([0, 3, 4]);
  const added = Buffer.from([0, 5, 6]);
  try {
    for (const root of [source, target]) {
      mkdirSync(join(root, slice), { recursive: true });
      execFileSync('git', ['init', '-q'], { cwd: root });
      writeFileSync(join(root, slice, 'states-dark.png'), old);
      writeFileSync(join(root, slice, 'obsolete.png'), old);
      execFileSync('git', ['add', '--', slice], { cwd: root });
    }
    writeFileSync(join(source, slice, 'states-dark.png'), changed);
    writeFileSync(join(source, slice, 'states-light.png'), added);
    unlinkSync(join(source, slice, 'obsolete.png'));
    writeFileSync(join(source, 'unrelated.txt'), 'preserve outside the patch');
    const patch = join(fixture, 'references.patch');
    writeBaselinePatch(source, patch);
    expect(readFileSync(patch, 'utf8')).not.toContain('unrelated.txt');
    execFileSync('git', ['apply', '--', patch], { cwd: target });
    expect(readFileSync(join(target, slice, 'states-dark.png'))).toEqual(
      changed
    );
    expect(readFileSync(join(target, slice, 'states-light.png'))).toEqual(
      added
    );
    expect(existsSync(join(target, slice, 'obsolete.png'))).toBe(false);
    expect(existsSync(join(target, 'unrelated.txt'))).toBe(false);
  } finally {
    removeTree(fixture, { whenLocked: 'leave' });
  }
});
