// @io-wall-ok
import { appObjectStoreRootPrefix } from '@libs/infra/namespace-bindings';
import { wallIo } from '@pkgs/io';
import { createLogger } from '@pkgs/logger';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import { createS3ObjectStore } from '@pkgs/object-store/impl-s3';
import type { ObjectStore } from '@pkgs/object-store/interface';
import { S3SecretName } from '@pkgs/object-store/s3-config';
import type { SecretStore } from '@pkgs/secret-store';

const io = wallIo();
const log = createLogger({ name: 'api-object-store', now: io.clock.now });

const S3_SECRET_NAMES = [
  S3SecretName.accessKeyId,
  S3SecretName.secretAccessKey,
  S3SecretName.bucket,
  S3SecretName.endpoint,
  S3SecretName.region,
] as const;

/**
 * S3-compatible object store for the API Worker. Credentials are loaded from
 * env bindings at boot; every key is scoped via {@link createS3ObjectStore}.
 *
 * Non-prod (`SECRETS_ENV=dev`) uses local `@apps/minio` via `.dev.vars` S3
 * overrides. Production uses Infisical → Backblaze B2.
 *
 * Object storage only backs non-critical caches (e.g. TTS audio). When the S3
 * credentials are absent, fall back to an ephemeral in-memory store so the
 * Worker still boots. Production misconfiguration is caught earlier by the
 * deploy-time `s3-bucket` resource check.
 */
export type CreateApiObjectStoreOptions = {
  /** Secrets env (`dev` / `prd`). Reserved for callers; no longer gates in-memory. */
  readonly secretsEnv?: string | null;
};

export async function createApiObjectStore(
  secretStore: SecretStore,
  _options: CreateApiObjectStoreOptions = {}
): Promise<ObjectStore> {
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
