import { PRODUCT_CONFIG } from '@libs/db/public/product-config';
import { assert } from '@pkgs/assert';
import {
  ensureR2Bucket,
  resolveR2ProvisionAuth,
} from '@pkgs/object-store-s3/r2-api';

export async function ensureObjectStoreBuckets(): Promise<void> {
  const { accountId, apiToken } = resolveR2ProvisionAuth();
  const buckets = PRODUCT_CONFIG.objectStore.buckets;
  for (const name of [buckets.development, buckets.production]) {
    assert.ok(name.trim().length > 0, 'Bucket name required');
    await ensureR2Bucket(accountId, apiToken, name);
  }
}
