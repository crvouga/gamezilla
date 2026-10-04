import { describe } from 'bun:test';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared/impl-in-memory';
import { runObjectStoreContractTests } from '@pkgs/object-store-root-shared/object-store-contract';

/** Fake-tier port suite. Real S3-compatible: *.contract.test.ts */
describe('ObjectStore — ObjectStoreImplInMemory (port suite)', () => {
  runObjectStoreContractTests(() => new ObjectStoreImplInMemory());
});

describe('ObjectStore — ObjectStoreImplInMemory withPrefix (port suite)', () => {
  runObjectStoreContractTests(() =>
    new ObjectStoreImplInMemory().withPrefix('test/')
  );
});
