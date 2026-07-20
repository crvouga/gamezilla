/**
 * Memoized per-env S3 secret seed: ensure R2 bucket + mint credentials once,
 * then each S3_* Secret.seed() picks its field.
 */
import { assert } from '@pkgs/assert';
import { PROJECT_CONFIG } from '../../project-config';
import {
  DEVELOPMENT_SECRETS_ENV,
  PRODUCTION_SECRETS_ENV,
} from '../../shared/database-url-policy';
import { cfAccountId, cfHeaders } from '../secrets/cloudflare';
import type { SecretsEnv } from '../secrets/secret';
import { setSecretIn } from '../secrets/secrets-io';
import { ensureR2Bucket, r2S3Endpoint } from './r2-buckets';
import { mintR2S3Credentials, type R2S3Credentials } from './r2-s3-credentials';

const S3_REGION = 'auto';

export type SeededObjectStoreS3 = {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly bucket: string;
  readonly endpoint: string;
  readonly region: string;
};

const cache = new Map<SecretsEnv, Promise<SeededObjectStoreS3>>();

function bucketForEnv(env: SecretsEnv): string {
  return env === DEVELOPMENT_SECRETS_ENV
    ? PROJECT_CONFIG.objectStore.buckets.development
    : PROJECT_CONFIG.objectStore.buckets.production;
}

function matchesTarget(
  stored: ReadonlyMap<string, string>,
  target: SeededObjectStoreS3
): boolean {
  return (
    (stored.get('S3_BUCKET') ?? '').trim() === target.bucket &&
    (stored.get('S3_ENDPOINT') ?? '').trim() === target.endpoint &&
    (stored.get('S3_REGION') ?? '').trim() === target.region &&
    (stored.get('S3_ACCESS_KEY_ID') ?? '').trim().length > 0 &&
    (stored.get('S3_SECRET_ACCESS_KEY') ?? '').trim().length > 0
  );
}

async function mintAndWrite(
  env: SecretsEnv,
  accountId: string,
  headers: Record<string, string>
): Promise<SeededObjectStoreS3> {
  const bucket = bucketForEnv(env);
  await ensureR2Bucket(accountId, bucket, headers);
  const credentials: R2S3Credentials = await mintR2S3Credentials({
    accountId,
    bucketName: bucket,
    tokenName: `gamezilla-s3-${env}`,
    headers,
  });
  const seeded: SeededObjectStoreS3 = {
    accessKeyId: credentials.accessKeyId,
    secretAccessKey: credentials.secretAccessKey,
    bucket,
    endpoint: r2S3Endpoint(accountId),
    region: S3_REGION,
  };
  await setSecretIn(env, 'S3_BUCKET', seeded.bucket);
  await setSecretIn(env, 'S3_ENDPOINT', seeded.endpoint);
  await setSecretIn(env, 'S3_REGION', seeded.region);
  await setSecretIn(env, 'S3_ACCESS_KEY_ID', seeded.accessKeyId);
  await setSecretIn(env, 'S3_SECRET_ACCESS_KEY', seeded.secretAccessKey);
  return seeded;
}

/**
 * Ensure both R2 buckets exist (dev + prd). Called from S3BucketResource
 * and as a side effect of seeding.
 */
export async function ensureObjectStoreBuckets(): Promise<void> {
  const accountId = cfAccountId();
  const headers = cfHeaders();
  assert.ok(accountId.length > 0, 'CLOUDFLARE_ACCOUNT_ID required for R2');
  const buckets = PROJECT_CONFIG.objectStore.buckets;
  for (const name of [buckets.development, buckets.production]) {
    await ensureR2Bucket(accountId, name, headers);
  }
}

export function seedObjectStoreS3ForEnv(
  env: SecretsEnv,
  secrets: ReadonlyMap<string, string>
): Promise<SeededObjectStoreS3> {
  const existing = cache.get(env);
  if (existing !== undefined) return existing;

  const promise = (async (): Promise<SeededObjectStoreS3> => {
    const accountId =
      secrets.get('CLOUDFLARE_ACCOUNT_ID')?.trim() || cfAccountId();
    const token =
      secrets.get('CLOUDFLARE_API_TOKEN')?.trim() ||
      (process.env['CLOUDFLARE_API_TOKEN'] ?? '').trim();
    assert.ok(
      accountId.length > 0,
      'CLOUDFLARE_ACCOUNT_ID required to seed S3'
    );
    assert.ok(token.length > 0, 'CLOUDFLARE_API_TOKEN required to seed S3');
    const headers = cfHeaders(token);

    const targetBase: SeededObjectStoreS3 = {
      accessKeyId: (secrets.get('S3_ACCESS_KEY_ID') ?? '').trim(),
      secretAccessKey: (secrets.get('S3_SECRET_ACCESS_KEY') ?? '').trim(),
      bucket: bucketForEnv(env),
      endpoint: r2S3Endpoint(accountId),
      region: S3_REGION,
    };

    if (matchesTarget(secrets, targetBase)) {
      return targetBase;
    }
    return mintAndWrite(env, accountId, headers);
  })();

  cache.set(env, promise);
  return promise;
}

export function clearS3SecretSeedCache(): void {
  cache.clear();
}

export function applySeededS3ToEnv(seeded: SeededObjectStoreS3): void {
  process.env['S3_BUCKET'] = seeded.bucket;
  process.env['S3_ENDPOINT'] = seeded.endpoint;
  process.env['S3_REGION'] = seeded.region;
  process.env['S3_ACCESS_KEY_ID'] = seeded.accessKeyId;
  process.env['S3_SECRET_ACCESS_KEY'] = seeded.secretAccessKey;
}

export { PRODUCTION_SECRETS_ENV, DEVELOPMENT_SECRETS_ENV };
