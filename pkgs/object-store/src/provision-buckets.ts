import { assert } from '@pkgs/assert';
import { authorizeB2FromEnv, ensureB2Bucket } from './b2-api';
import { OBJECT_STORE_BUCKETS } from './object-store-config';

export async function ensureObjectStoreBuckets(): Promise<void> {
  const auth = await authorizeB2FromEnv();
  assert.ok(auth.accountId.length > 0, 'B2 account ID required');
  for (const name of [
    OBJECT_STORE_BUCKETS.development,
    OBJECT_STORE_BUCKETS.production,
  ]) {
    await ensureB2Bucket(auth, name);
  }
}

export { OBJECT_STORE_BUCKETS };
