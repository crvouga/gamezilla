/**
 * Regression: a parallel spec run removed a report `frames` directory after
 * `mkdir` and before `open` of the temp file. The put failed `ENOENT` and
 * took the trace down. Recreating the directory and retrying must leave the
 * object in place.
 */
import { afterEach, expect, test } from 'bun:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server-ts/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server-ts/wall-node-fs';
import type { NodeFs } from '@pkgs/object-store-node-fs-shared-ts/node-fs';

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => removeTree(dir, { whenLocked: 'leave' }))
  );
});

function enoent(path: string): Error {
  return Object.assign(
    new Error(`ENOENT: no such file or directory, open '${path}'`),
    { code: 'ENOENT' }
  );
}

// regression: report-frame-put-enoent
test('put retries when the frames directory disappears before the temp write', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'object-store-enoent-'));
  dirs.push(dir);
  const wall = wallNodeFs();
  let dropped = false;
  const fs: NodeFs = {
    ...wall,
    async writeFile(path, contents) {
      if (!dropped) {
        dropped = true;
        removeTree(dirname(path));
        throw enoent(path);
      }
      await wall.writeFile(path, contents);
    },
  };
  const store = createNodeFsObjectStore({
    rootDir: dir,
    fs,
    layout: 'tree',
  });
  const key = 'runs/latest/tests/trace/frames/f-00729.topology.nodes.json';
  const bytes = new TextEncoder().encode('{"nodes":[]}');
  await store.put(key, bytes, 'application/json');
  const stored = await store.get(key);
  expect(stored).not.toBeNull();
  expect(stored?.size).toBe(bytes.byteLength);
});
