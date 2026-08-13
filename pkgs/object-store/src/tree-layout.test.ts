import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { readUtf8, writeUtf8 } from './helpers';
import { createNodeFsObjectStore } from './impl-node-fs';
import { wallNodeFs } from './wall-node-fs';

describe('ObjectStoreImplNodeFs tree layout', () => {
  const dirs: string[] = [];
  afterEach(async () => {
    await Promise.all(
      dirs.splice(0).map((d) => rm(d, { recursive: true, force: true }))
    );
  });

  async function openTree() {
    const dir = await mkdtemp(join(tmpdir(), 'object-store-tree-'));
    dirs.push(dir);
    return createNodeFsObjectStore({
      rootDir: dir,
      fs: wallNodeFs(),
      layout: 'tree',
      skipDirNames: new Set(['node_modules', '.git']),
    });
  }

  test('put/get round-trips without meta sidecars', async () => {
    const store = await openTree();
    await writeUtf8(store, 'pkgs/foo/bar.ts', 'export const x = 1;\n');
    expect(await readUtf8(store, 'pkgs/foo/bar.ts')).toBe(
      'export const x = 1;\n'
    );
    expect(await store.head('pkgs/foo/bar.ts')).toBe(true);
    expect(await store.listKeys('pkgs/')).toEqual(['pkgs/foo/bar.ts']);
  });

  test('skipDirNames hides skipped directories from listKeys', async () => {
    const store = await openTree();
    await writeUtf8(store, 'keep.ts', 'a');
    await writeUtf8(store, 'node_modules/hidden.ts', 'b');
    expect([...(await store.listKeys())]).toEqual(['keep.ts']);
  });
});
