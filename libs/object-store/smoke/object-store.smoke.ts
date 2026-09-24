// @io-wall-ok — live smoke probe (process root against the env's R2 bucket).
import { describe, expect, test } from 'bun:test';
import { PRODUCT_CONFIG } from '@libs/db/public/product-config';
import { createS3ObjectStore } from '@pkgs/object-store-s3/impl-s3';
import { S3SecretName } from '@pkgs/object-store-s3/s3-config';
import { isProductionSecretsEnv } from '@pkgs/secrets-config/deploy-mode';

function requireEnv(name: string): string {
  const value = process.env[name]?.trim() ?? '';
  expect(value, `${name} missing from secrets env`).not.toBe('');
  return value;
}

function expectedBucket(): string {
  const { buckets } = PRODUCT_CONFIG.objectStore;
  return isProductionSecretsEnv() ? buckets.production : buckets.development;
}

describe('object store (R2)', () => {
  test('S3_BUCKET is this secrets env’s bucket', () => {
    expect(requireEnv(S3SecretName.bucket)).toBe(expectedBucket());
  });

  test('app key can write, read, and delete under the root prefix', async () => {
    const store = createS3ObjectStore({
      accessKeyId: requireEnv(S3SecretName.accessKeyId),
      secretAccessKey: requireEnv(S3SecretName.secretAccessKey),
      bucket: requireEnv(S3SecretName.bucket),
      endpoint: requireEnv(S3SecretName.endpoint),
      region: process.env[S3SecretName.region]?.trim() || 'auto',
      rootPrefix: `${PRODUCT_CONFIG.objectStore.namespace}/`,
    });
    const key = 'smoke/round-trip.txt';
    const bytes = new TextEncoder().encode('smoke');
    await store.put(key, bytes, 'text/plain');
    try {
      const stored = await store.get(key);
      expect(stored).not.toBeNull();
      expect(await new Response(stored?.body).text()).toBe('smoke');
    } finally {
      await store.delete(key);
    }
    expect(await store.head(key)).toBe(false);
  });
});
