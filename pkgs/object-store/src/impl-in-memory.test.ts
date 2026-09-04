import { describe } from 'bun:test';
import { ObjectStoreImplInMemory } from './impl-in-memory';
import { runObjectStoreContractTests } from './object-store-contract';

/** Fake-tier port suite. Real S3/MinIO: *.contract.test.ts */
describe('ObjectStore — ObjectStoreImplInMemory (port suite)', () => {
  runObjectStoreContractTests(() => new ObjectStoreImplInMemory());
});

describe('ObjectStore — ObjectStoreImplInMemory withPrefix (port suite)', () => {
  runObjectStoreContractTests(() =>
    new ObjectStoreImplInMemory().withPrefix('test/')
  );
});
