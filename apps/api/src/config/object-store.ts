import { createLogger } from '@pkgs/logger';
import { B2SecretName } from '@pkgs/object-store/b2-config';
import { createB2ObjectStore } from '@pkgs/object-store/impl-b2';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import type { ObjectStore } from '@pkgs/object-store/interface';
import type { SecretStore } from '@pkgs/secret-store';

const log = createLogger({ name: 'api-object-store' });

const B2_SECRET_NAMES = [
  B2SecretName.applicationKeyId,
  B2SecretName.applicationKey,
  B2SecretName.bucketName,
  B2SecretName.s3Endpoint,
  B2SecretName.s3Region,
] as const;

/**
 * Backblaze B2 object store for the API Worker. Credentials are loaded from
 * Vault at boot; every key is scoped under `gamezilla/` inside
 * {@link createB2ObjectStore}.
 *
 * Object storage only backs non-critical caches (e.g. TTS audio). When the B2
 * credentials are absent — local dev, preview, and CI `qa` runs that never
 * provision B2 — fall back to an ephemeral in-memory store so the Worker still
 * boots and serves auth / patch-db / rooms instead of latching fatal and
 * answering every request with `503`. Production misconfiguration is caught
 * earlier by the deploy-time `b2-buckets` resource check.
 */
export async function createApiObjectStore(
  secretStore: SecretStore
): Promise<ObjectStore> {
  const secrets = await secretStore.getOptionalMany(B2_SECRET_NAMES);
  const missing = B2_SECRET_NAMES.filter((name) => secrets[name] === null);

  if (missing.length > 0) {
    log.warn('B2 credentials missing — using in-memory object store', {
      missing,
    });
    return new ObjectStoreImplInMemory();
  }

  return createB2ObjectStore({
    applicationKeyId: secrets[B2SecretName.applicationKeyId]!.readSecretValue(),
    applicationKey: secrets[B2SecretName.applicationKey]!.readSecretValue(),
    bucketName: secrets[B2SecretName.bucketName]!.readSecretValue(),
    s3Endpoint: secrets[B2SecretName.s3Endpoint]!.readSecretValue(),
    s3Region: secrets[B2SecretName.s3Region]!.readSecretValue(),
  });
}
