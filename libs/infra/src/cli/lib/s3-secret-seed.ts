/**
 * Memoized per-env object-store secret seed: ensure B2 bucket + mint app key
 * once, then each Secret.seed() picks its field.
 */
import { assert } from '@pkgs/assert';
import { PROJECT_CONFIG } from '../../project-config';
import {
  DEVELOPMENT_SECRETS_ENV,
  PRODUCTION_SECRETS_ENV,
} from '../../shared/database-url-policy';
import type { SecretsEnv } from '../secrets/secret';
import { setSecretIn } from '../secrets/secrets-io';
import {
  authorizeB2FromEnv,
  b2S3Region,
  clearB2AuthCache,
  ensureB2Bucket,
  mintB2S3Credentials,
  type B2Auth,
  type B2S3Credentials,
} from './b2-api';

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
    (stored.get('B2_APP_KEY_ID') ?? '').trim().length > 0 &&
    (stored.get('B2_APP_KEY') ?? '').trim().length > 0
  );
}

async function writeSeeded(
  env: SecretsEnv,
  seeded: SeededObjectStoreS3
): Promise<void> {
  await setSecretIn(env, 'S3_BUCKET', seeded.bucket);
  await setSecretIn(env, 'S3_ENDPOINT', seeded.endpoint);
  await setSecretIn(env, 'S3_REGION', seeded.region);
  await setSecretIn(env, 'B2_APP_KEY_ID', seeded.accessKeyId);
  await setSecretIn(env, 'B2_APP_KEY', seeded.secretAccessKey);
}

async function mintAndWrite(
  env: SecretsEnv,
  auth: B2Auth
): Promise<SeededObjectStoreS3> {
  const bucket = bucketForEnv(env);
  const bucketId = await ensureB2Bucket(auth, bucket);
  const credentials: B2S3Credentials = await mintB2S3Credentials({
    auth,
    bucketId,
    keyName: `gamezilla-s3-${env}`,
  });
  const seeded: SeededObjectStoreS3 = {
    accessKeyId: credentials.accessKeyId,
    secretAccessKey: credentials.secretAccessKey,
    bucket,
    endpoint: auth.s3ApiUrl,
    region: b2S3Region(auth.s3ApiUrl),
  };
  await writeSeeded(env, seeded);
  return seeded;
}

/**
 * Ensure both B2 buckets exist (dev + prd). Called from S3BucketResource
 * and as a side effect of seeding.
 */
export async function ensureObjectStoreBuckets(): Promise<void> {
  const auth = await authorizeB2FromEnv();
  assert.ok(auth.accountId.length > 0, 'B2 account ID required');
  const buckets = PROJECT_CONFIG.objectStore.buckets;
  for (const name of [buckets.development, buckets.production]) {
    await ensureB2Bucket(auth, name);
  }
}

export function seedObjectStoreS3ForEnv(
  env: SecretsEnv,
  secrets: ReadonlyMap<string, string>
): Promise<SeededObjectStoreS3> {
  const existing = cache.get(env);
  if (existing !== undefined) return existing;

  const promise = (async (): Promise<SeededObjectStoreS3> => {
    const auth = await authorizeB2FromEnv(secrets);
    const targetBase: SeededObjectStoreS3 = {
      accessKeyId: (secrets.get('B2_APP_KEY_ID') ?? '').trim(),
      secretAccessKey: (secrets.get('B2_APP_KEY') ?? '').trim(),
      bucket: bucketForEnv(env),
      endpoint: auth.s3ApiUrl,
      region: b2S3Region(auth.s3ApiUrl),
    };

    if (matchesTarget(secrets, targetBase)) {
      return targetBase;
    }
    return mintAndWrite(env, auth);
  })();

  cache.set(env, promise);
  return promise;
}

export function clearS3SecretSeedCache(): void {
  cache.clear();
  clearB2AuthCache();
}

export function applySeededS3ToEnv(seeded: SeededObjectStoreS3): void {
  process.env['S3_BUCKET'] = seeded.bucket;
  process.env['S3_ENDPOINT'] = seeded.endpoint;
  process.env['S3_REGION'] = seeded.region;
  process.env['B2_APP_KEY_ID'] = seeded.accessKeyId;
  process.env['B2_APP_KEY'] = seeded.secretAccessKey;
}

export { PRODUCTION_SECRETS_ENV, DEVELOPMENT_SECRETS_ENV };
