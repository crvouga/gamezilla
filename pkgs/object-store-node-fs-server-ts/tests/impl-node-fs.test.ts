import { afterEach, describe } from 'bun:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server-ts/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server-ts/wall-node-fs';
import { runObjectStoreContractTests } from '@pkgs/object-store-root-shared-ts/object-store-contract';
import { removeTree } from '@pkgs/os-server-ts/remove-tree';

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
