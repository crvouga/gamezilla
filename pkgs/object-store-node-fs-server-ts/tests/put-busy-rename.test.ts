/**
 * Windows refuses `rename` onto a file another process is replacing at the
 * same moment (`EPERM`), so concurrent puts of one key failed there while
 * POSIX replaced the file atomically. A put must outlast a busy destination.
 */
import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server-ts/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server-ts/wall-node-fs';
import type { NodeFs } from '@pkgs/object-store-node-fs-shared-ts/node-fs';

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

// regression: node-fs-put-windows-busy-rename
test('a put outlasts a destination another writer keeps busy', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'object-store-busy-'));
  dirs.push(dir);
  const wall = wallNodeFs();
  let refusals = 3;
  const fs: NodeFs = {
    ...wall,
    async rename(from, to) {
      if (refusals-- > 0)
        throw Object.assign(
          new Error(`EPERM: operation not permitted, rename '${from}'`),
          { code: 'EPERM' }
        );
      await wall.rename(from, to);
    },
  };
  const store = createNodeFsObjectStore({ rootDir: dir, fs, layout: 'tree' });
  const bytes = new TextEncoder().encode('{"seed":1}');
  await store.put('seed.json', bytes, 'application/json');
  expect((await store.get('seed.json'))?.size).toBe(bytes.byteLength);
});
