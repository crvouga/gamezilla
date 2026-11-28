import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server-ts/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server-ts/wall-node-fs';
import { runObjectStoreContractTests } from '@pkgs/object-store-root-shared-ts/object-store-contract';

describe('ObjectStore — ObjectStoreImplNodeFs sidecar (port suite)', () => {
  const dirs: string[] = [];
  afterEach(async () => {
    await Promise.all(
      dirs.splice(0).map((d) => removeTree(d, { whenLocked: 'leave' }))
    );
  });
  runObjectStoreContractTests(async () => {
    const dir = await mkdtemp(join(tmpdir(), 'object-store-fs-'));
    dirs.push(dir);
    return createNodeFsObjectStore({
      rootDir: dir,
      fs: wallNodeFs(),
      layout: 'sidecar',
    });
  });
});

// regression: journey-fluent-svg-content-type
test('tree storage identifies Fluent SVG artwork in a release bundle', async () => {
  const rootDir = await mkdtemp(join(tmpdir(), 'release-artwork-'));
  try {
    await writeFile(
      join(rootDir, 'video-game.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg"/>'
    );
    const store = createNodeFsObjectStore({
      rootDir,
      fs: wallNodeFs(),
      layout: 'tree',
    });
    await writeFile(join(rootDir, 'video-game.webp'), new Uint8Array());
    expect((await store.get('video-game.webp'))?.contentType).toBe(
      'image/webp'
    );
    const file = await store.get('video-game.svg');
    expect(file?.contentType).toBe('image/svg+xml');
  } finally {
    removeTree(rootDir, { whenLocked: 'leave' });
  }
});
