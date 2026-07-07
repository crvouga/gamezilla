import { DEVELOPMENT_SECRETS_ENV } from '@libs/infra/shared/database-url-policy';
import { appObjectStoreRootPrefix } from '@libs/infra/namespace-bindings';
import { createLogger } from '@pkgs/logger';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import { createS3ObjectStore } from '@pkgs/object-store/impl-s3';
import type { ObjectStore } from '@pkgs/object-store/interface';
import { S3SecretName } from '@pkgs/object-store/s3-config';
import type { SecretStore } from '@pkgs/secret-store';

const log = createLogger({ name: 'api-object-store' });

let devInMemoryObjectStoreNoticed = false;

const S3_SECRET_NAMES = [
  S3SecretName.accessKeyId,
  S3SecretName.secretAccessKey,
  S3SecretName.bucket,
  S3SecretName.endpoint,
  S3SecretName.region,
] as const;

/**
 * S3-compatible object store for the API Worker. Credentials are loaded from
 * Credentials are loaded from env bindings at boot; every key is scoped
 * {@link createS3ObjectStore}.
 *
 * Object storage only backs non-critical caches (e.g. TTS audio). When the S3
 * credentials are absent — local dev, preview, and CI `qa` runs that never
 * provision object storage — fall back to an ephemeral in-memory store so the
 * Worker still boots and serves auth / patch-db / rooms instead of latching
 * fatal and answering every request with `503`. Production misconfiguration is
 * caught earlier by the deploy-time `s3-bucket` resource check.
 */
export type CreateApiObjectStoreOptions = {
  /** Secrets env (`dev` / `prd`). Dev uses an in-memory store so local wrangler is not blocked by remote S3. */
  readonly secretsEnv?: string | null;
};

export async function createApiObjectStore(
  secretStore: SecretStore,
  options: CreateApiObjectStoreOptions = {}
): Promise<ObjectStore> {
  if (options.secretsEnv === DEVELOPMENT_SECRETS_ENV) {
    if (!devInMemoryObjectStoreNoticed) {
      devInMemoryObjectStoreNoticed = true;
      log.debug('dev secrets env — using in-memory object store');
    }
    return new ObjectStoreImplInMemory();
  }

  const secrets = await secretStore.getOptionalMany(S3_SECRET_NAMES);
  const missing = S3_SECRET_NAMES.filter((name) => secrets[name] === null);

  if (missing.length > 0) {
    log.warn('S3 credentials missing — using in-memory object store', {
      missing,
    });
    return new ObjectStoreImplInMemory();
  }

  return createS3ObjectStore({
    accessKeyId: secrets[S3SecretName.accessKeyId]!.readSecretValue(),
    secretAccessKey: secrets[S3SecretName.secretAccessKey]!.readSecretValue(),
    bucket: secrets[S3SecretName.bucket]!.readSecretValue(),
    endpoint: secrets[S3SecretName.endpoint]!.readSecretValue(),
    region: secrets[S3SecretName.region]!.readSecretValue(),
    rootPrefix: appObjectStoreRootPrefix(),
  });
}
