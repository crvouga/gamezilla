// @io-wall-ok — live health: the environment's R2 bucket.
/** `specs/health/object-store.feature`. */

import { expect } from 'bun:test';
import { PRODUCT_CONFIG } from '@libs/db/public/product-config';
import { envResourceNames } from '@libs/infra/public/naming';
import { createS3ObjectStore } from '@pkgs/object-store-s3/impl-s3';
import { S3SecretName } from '@pkgs/object-store-s3/s3-config';
import { Then } from './define';
import { requireSecret } from './live-world';

Then("the object store bucket is this environment's bucket", (w) => {
  expect(requireSecret(S3SecretName.bucket)).toBe(
    envResourceNames(w.env).bucket
  );
});

Then(
  "the app's key can write, read back and delete a file under its root prefix",
  async (w) => {
    const store = createS3ObjectStore({
      accessKeyId: requireSecret(S3SecretName.accessKeyId),
      secretAccessKey: requireSecret(S3SecretName.secretAccessKey),
      bucket: requireSecret(S3SecretName.bucket),
      endpoint: requireSecret(S3SecretName.endpoint),
      region: process.env[S3SecretName.region]?.trim() || 'auto',
      rootPrefix: `${PRODUCT_CONFIG.objectStore.namespace}/`,
      http: w.http,
    });
    const key = 'health/round-trip.txt';
    const bytes = new TextEncoder().encode('health');
    await store.put(key, bytes, 'text/plain');
    try {
      const stored = await store.get(key);
      expect(stored).not.toBeNull();
      expect(await new Response(stored?.body).text()).toBe('health');
    } finally {
      await store.delete(key);
    }
    expect(await store.head(key)).toBe(false);
  }
);
