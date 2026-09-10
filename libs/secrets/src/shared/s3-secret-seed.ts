/**
 * Memoized per-env object-store secret seed: ensure R2 bucket + mint S3 token
 * once, then each Secret.seed() picks its field.
 */

import { PRODUCT_CONFIG } from '@libs/db/public/product-config';
import {
  DEVELOPMENT_SECRETS_ENV,
  PRODUCTION_SECRETS_ENV,
} from '@pkgs/database-url-policy';
import {
  ensureR2Bucket,
  mintR2S3Credentials,
  R2_S3_REGION,
  r2S3Endpoint,
  resolveR2ProvisionAuth,
} from '@pkgs/object-store-s3/r2-api';
import type { SecretsEnv } from './secrets/secret';
import { setSecretIn } from './secrets/secrets-io';

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
    ? PRODUCT_CONFIG.objectStore.buckets.development
    : PRODUCT_CONFIG.objectStore.buckets.production;
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

async function writeSeeded(
  env: SecretsEnv,
  seeded: SeededObjectStoreS3
): Promise<void> {
  await setSecretIn(env, 'S3_BUCKET', seeded.bucket);
  await setSecretIn(env, 'S3_ENDPOINT', seeded.endpoint);
  await setSecretIn(env, 'S3_REGION', seeded.region);
  await setSecretIn(env, 'S3_ACCESS_KEY_ID', seeded.accessKeyId);
  await setSecretIn(env, 'S3_SECRET_ACCESS_KEY', seeded.secretAccessKey);
}

async function mintAndWrite(
  env: SecretsEnv,
  accountId: string,
  apiToken: string
): Promise<SeededObjectStoreS3> {
  const bucket = bucketForEnv(env);
  await ensureR2Bucket(accountId, apiToken, bucket);
  const credentials = await mintR2S3Credentials({
    accountId,
    apiToken,
    bucket,
    tokenName: `gamezilla-s3-${env}`,
  });
  const seeded: SeededObjectStoreS3 = {
    accessKeyId: credentials.accessKeyId,
    secretAccessKey: credentials.secretAccessKey,
    bucket,
    endpoint: r2S3Endpoint(accountId),
    region: R2_S3_REGION,
  };
  await writeSeeded(env, seeded);
  return seeded;
}

export function seedObjectStoreS3ForEnv(
  env: SecretsEnv,
  secrets: ReadonlyMap<string, string>
): Promise<SeededObjectStoreS3> {
  const existing = cache.get(env);
  if (existing !== undefined) return existing;

  const promise = (async (): Promise<SeededObjectStoreS3> => {
    const { accountId, apiToken } = resolveR2ProvisionAuth(secrets);
    const targetBase: SeededObjectStoreS3 = {
      accessKeyId: (secrets.get('S3_ACCESS_KEY_ID') ?? '').trim(),
      secretAccessKey: (secrets.get('S3_SECRET_ACCESS_KEY') ?? '').trim(),
      bucket: bucketForEnv(env),
      endpoint: r2S3Endpoint(accountId),
      region: R2_S3_REGION,
    };

    if (matchesTarget(secrets, targetBase)) {
      return targetBase;
    }
    return mintAndWrite(env, accountId, apiToken);
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

export { DEVELOPMENT_SECRETS_ENV, PRODUCTION_SECRETS_ENV };
