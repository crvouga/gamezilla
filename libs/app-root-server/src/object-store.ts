import { appObjectStoreRootPrefix } from '@libs/db-shared/scope';
import type { HttpClient } from '@pkgs/http-client-shared/types';
import { createLogger } from '@pkgs/logger-shared/logger';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared/impl-in-memory';
import type { ObjectStore } from '@pkgs/object-store-root-shared/interface';
import { createS3ObjectStore } from '@pkgs/object-store-s3-server/impl-s3';
import { S3SecretName } from '@pkgs/object-store-s3-shared/s3-config';
import type { SecretStore } from '@pkgs/secret-store-shared/interface';
import { createSharedDataStore } from './shared-data-store';
import { SharedObjectStore } from './shared-object-store';

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
 * Localhost stack uses `@pkgs/s3-server`; production uses Infisical → Cloudflare R2.
 *
 * Object storage only backs non-critical caches (e.g. TTS audio). When the S3
 * credentials are absent, fall back to an ephemeral in-memory store so the
 * Worker still boots. Production misconfiguration is caught earlier by the
 * deploy-time `s3-bucket` resource check.
 */
export type CreateApiObjectStoreOptions = {
  /** Secrets env name (`dev`, `prd`, …). Reserved for callers; no longer gates in-memory. */
  readonly secretsEnv?: string | null;
  /** Injected clock from the worker composition root. */
  readonly now: () => number;
  /** Transport for S3 requests, injected at the worker composition root. */
  readonly http: HttpClient;
  /**
   * When true, missing S3 secrets throw instead of falling back to in-memory.
   * Use for durable stores (product-harness snapshots); leave unset for API caches.
   */
  readonly requireCredentials?: boolean;
};

export async function createApiObjectStore(
  secretStore: SecretStore,
  options: CreateApiObjectStoreOptions
): Promise<ObjectStore> {
  return new SharedObjectStore(
    await createEnvironmentObjectStore(secretStore, options),
    await createSharedDataStore(secretStore, options.http)
  );
}

async function createEnvironmentObjectStore(
  secretStore: SecretStore,
  options: CreateApiObjectStoreOptions
): Promise<ObjectStore> {
  const log = createLogger({ name: 'api-object-store', now: options.now });
  const secrets = await secretStore.getOptionalMany(S3_SECRET_NAMES);
  const missing = S3_SECRET_NAMES.filter((name) => secrets[name] === null);

  if (missing.length > 0) {
    if (options.requireCredentials === true) {
      throw new Error(
        `S3 credentials required but missing: ${missing.join(', ')}. ` +
          'Run under `bun run libs/secrets-server/scripts/secrets-run.ts` with SECRETS_ENV=dev.'
      );
    }
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
    http: options.http,
  });
}
