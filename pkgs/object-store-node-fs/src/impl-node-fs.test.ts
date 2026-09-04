import { afterEach, describe } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runObjectStoreContractTests } from '@pkgs/object-store/object-store-contract';
import { createNodeFsObjectStore } from './impl-node-fs';
import { wallNodeFs } from './wall-node-fs';

describe('ObjectStore — ObjectStoreImplNodeFs sidecar (port suite)', () => {
  const dirs: string[] = [];
  afterEach(async () => {
    await Promise.all(
      dirs.splice(0).map((d) => rm(d, { recursive: true, force: true }))
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
