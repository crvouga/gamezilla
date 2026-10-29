import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readCommittedSpecs } from '@libs/harness-ts/committed-specs';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server-ts/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server-ts/wall-node-fs';
import { writeUtf8 } from '@pkgs/object-store-root-shared-ts/helpers';

// regression: report-inventory-wrong-revision
test('inventory reads the selected commit instead of current or ignored files', async () => {
  const root = mkdtempSync(join(tmpdir(), 'report-commit-'));
  const store = createNodeFsObjectStore({
    rootDir: root,
    fs: wallNodeFs(),
    layout: 'tree',
  });
  const git = (...args: string[]) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr);
    return result.stdout.trim();
  };
  try {
    git('init', '-q');
    await writeUtf8(
      store,
      'specs/example/counter.feature',
      'Feature: Original\n'
    );
    git('add', 'specs');
    git(
      '-c',
      'user.name=Example',
      '-c',
      'user.email=example@example.test',
      'commit',
      '-qm',
      'spec: original'
    );
    const sha = git('rev-parse', 'HEAD');
    await writeUtf8(
      store,
      'specs/example/counter.feature',
      'Feature: Working edit\n'
    );
    await writeUtf8(store, 'specs/example/ignored.txt', 'Must not appear');
    expect(readCommittedSpecs(root, sha)).toEqual([
      { path: 'specs/example/counter.feature', content: 'Feature: Original\n' },
    ]);
  } finally {
    removeTree(root, { whenLocked: 'leave' });
  }
});
