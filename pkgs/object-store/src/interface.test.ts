import { afterEach, describe } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ObjectStoreImplInMemory } from './impl-in-memory';
import { createNodeFsObjectStore } from './impl-node-fs';
import { runObjectStoreContractTests } from './object-store-contract';
import { wallNodeFs } from './wall-node-fs';

/** Fake-tier port suite. Real S3/MinIO: *.contract.test.ts */
describe('ObjectStore — ObjectStoreImplInMemory (port suite)', () => {
  runObjectStoreContractTests(() => new ObjectStoreImplInMemory());
});

describe('ObjectStore — ObjectStoreImplInMemory withPrefix (port suite)', () => {
  runObjectStoreContractTests(() =>
    new ObjectStoreImplInMemory().withPrefix('test/')
  );
});

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
