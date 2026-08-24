import { PRODUCT_CONFIG } from '@libs/db/public/product-config';
import { assert } from '@pkgs/assert';
import { authorizeB2FromEnv, ensureB2Bucket } from '@pkgs/object-store/b2-api';

export async function ensureObjectStoreBuckets(): Promise<void> {
  const auth = await authorizeB2FromEnv();
  assert.ok(auth.accountId.length > 0, 'B2 account ID required');
  const buckets = PRODUCT_CONFIG.objectStore.buckets;
  for (const name of [buckets.development, buckets.production]) {
    assert.ok(name.trim().length > 0, 'Bucket name required');
    await ensureB2Bucket(auth, name);
  }
}
