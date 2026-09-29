import { appObjectStoreRootPrefix } from '@libs/db/public/scope';
import { REPORTS_ROOT_PREFIX } from '@pkgs/harness-report';
import type { HttpClient } from '@pkgs/http-client';
import { createLogger } from '@pkgs/logger';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import type { ObjectStore } from '@pkgs/object-store/interface';
import { createS3ObjectStore } from '@pkgs/object-store-s3/impl-s3';
import { S3SecretName } from '@pkgs/object-store-s3/s3-config';
import type { SecretStore } from '@pkgs/secret-store';
import { ApiSecretName } from './secret-names';

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
  const log = createLogger({ name: 'api-object-store', now: options.now });
  const secrets = await secretStore.getOptionalMany(S3_SECRET_NAMES);
  const missing = S3_SECRET_NAMES.filter((name) => secrets[name] === null);

  if (missing.length > 0) {
    if (options.requireCredentials === true) {
      throw new Error(
        `S3 credentials required but missing: ${missing.join(', ')}. ` +
          'Run under `bun run libs/secrets/src/scripts/secrets-run.ts` with SECRETS_ENV=dev.'
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

const REPORTS_SECRET_NAMES = [
  ApiSecretName.reportsBucket,
  ApiSecretName.reportsEndpoint,
  ApiSecretName.reportsAccessKeyId,
  ApiSecretName.reportsSecretAccessKey,
] as const;

/**
 * The shared spec reports store (one R2 bucket every environment reads, keyed
 * by commit; `/api/reports`), through this environment's read-only
 * credential. Null without one: the reports routes then answer 503.
 */
export async function createReportsObjectStore(
  secretStore: SecretStore,
  options: { readonly http: HttpClient }
): Promise<ObjectStore | null> {
  const secrets = await secretStore.getOptionalMany(REPORTS_SECRET_NAMES);
  const value = (name: (typeof REPORTS_SECRET_NAMES)[number]): string | null =>
    secrets[name]?.readSecretValue().trim() || null;
  const bucket = value(ApiSecretName.reportsBucket);
  const endpoint = value(ApiSecretName.reportsEndpoint);
  const accessKeyId = value(ApiSecretName.reportsAccessKeyId);
  const secretAccessKey = value(ApiSecretName.reportsSecretAccessKey);
  if (
    bucket === null ||
    endpoint === null ||
    accessKeyId === null ||
    secretAccessKey === null
  ) {
    return null;
  }
  return createS3ObjectStore({
    accessKeyId,
    secretAccessKey,
    bucket,
    endpoint,
    region: 'auto',
    rootPrefix: REPORTS_ROOT_PREFIX,
    http: options.http,
  });
}
