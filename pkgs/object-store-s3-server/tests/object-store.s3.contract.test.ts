// Cached contract checks always use a private local Mockingbird S3, never credentials
// or a shared bucket injected by the environment.

import { afterAll, describe, expect, test } from 'bun:test';
import { runObjectStoreContractTests } from '@pkgs/object-store-root-shared/object-store-contract';
import { normalizeObjectStoreRootPrefix } from '@pkgs/object-store-root-shared/prefixes';
import { createS3ObjectStore } from '@pkgs/object-store-s3-server/impl-s3';
import {
  S3_ACCESS_KEY_ID,
  S3_BUCKET,
  S3_REGION,
  S3_SECRET_ACCESS_KEY,
  startS3Server,
} from '@pkgs/s3-server/s3-server';
import { createHarnessAdapters } from '@pkgs/uuid-shared/harness-adapters';

const handle = await startS3Server();
const s3Config = {
  endpoint: handle.endpoint,
  accessKeyId: S3_ACCESS_KEY_ID,
  secretAccessKey: S3_SECRET_ACCESS_KEY,
  bucket: S3_BUCKET,
  region: S3_REGION,
};

describe('ObjectStore S3-compatible (contract)', () => {
  const adapters = createHarnessAdapters({ seed: 1 });
  const createStore = () =>
    createS3ObjectStore({
      ...s3Config,
      rootPrefix: normalizeObjectStoreRootPrefix(
        `dst-contract/${adapters.createId()}/`
      ),
      http: { fetch: (input, init) => globalThis.fetch(input, init) },
    });

  runObjectStoreContractTests(createStore);

  // regression: s3-contract-shared-namespace
  test('an earlier test or concurrent run cannot add k to a fresh listing', async () => {
    expect(new URL(s3Config.endpoint).hostname).toBe('localhost');
    await createStore().put('k', new Uint8Array([1]), 'text/plain');
    const next = createStore();
    for (const key of ['b', 'a/x', 'a/y']) {
      await next.put(key, new Uint8Array([1]), 'text/plain');
    }
    expect(await next.listKeys()).toEqual(['a/x', 'a/y', 'b']);
  });
});

afterAll(async () => {
  await handle.stop();
});
