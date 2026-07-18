import {
  HeadBucketCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import { seedObjectStoreS3ForEnv } from '../lib/s3-secret-seed';
import {
  Secret,
  requireHttpsUrl,
  requireNonEmpty,
  type SecretInput,
  type SecretSeedInput,
} from './secret';

async function probeS3Access(input: SecretInput): Promise<void> {
  const accessKeyId = input.secrets.get('S3_ACCESS_KEY_ID')?.trim() ?? '';
  const secretAccessKey =
    input.secrets.get('S3_SECRET_ACCESS_KEY')?.trim() ?? '';
  const bucket = input.secrets.get('S3_BUCKET')?.trim() ?? '';
  const endpoint = input.secrets.get('S3_ENDPOINT')?.trim() ?? '';
  const region = input.secrets.get('S3_REGION')?.trim() || 'auto';

  requireNonEmpty(accessKeyId, 'S3_ACCESS_KEY_ID');
  requireNonEmpty(secretAccessKey, 'S3_SECRET_ACCESS_KEY');
  requireNonEmpty(bucket, 'S3_BUCKET');
  requireHttpsUrl(endpoint, 'S3_ENDPOINT');

  const client = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
  try {
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
      return;
    } catch {
      // Some S3-compatible providers (B2) return opaque HeadBucket errors;
      // fall back to a cheap list probe.
    }
    await client.send(
      new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 })
    );
  } catch (e) {
    throw new Error(
      `S3 probe failed for bucket ${bucket} at ${endpoint}: ${e instanceof Error ? e.message : String(e)}`
    );
  } finally {
    client.destroy();
  }
}

async function validateS3NonEmpty(
  input: SecretInput,
  label: string
): Promise<void> {
  requireNonEmpty(input.secretValue, label);
}

async function seedS3Field(
  input: SecretSeedInput,
  field: keyof Awaited<ReturnType<typeof seedObjectStoreS3ForEnv>>
): Promise<string> {
  const seeded = await seedObjectStoreS3ForEnv(input.env, input.secrets);
  return seeded[field];
}

export const S3_ACCESS_KEY_ID = new Secret({
  name: 'S3_ACCESS_KEY_ID',
  hint: 'S3-compatible object storage access key ID',
  pushToApiWorker: true,
  validate: probeS3Access,
  seed: (input) => seedS3Field(input, 'accessKeyId'),
});

export const S3_SECRET_ACCESS_KEY = new Secret({
  name: 'S3_SECRET_ACCESS_KEY',
  hint: 'S3-compatible object storage secret access key',
  pushToApiWorker: true,
  validate: (input) => validateS3NonEmpty(input, 'S3_SECRET_ACCESS_KEY'),
  seed: (input) => seedS3Field(input, 'secretAccessKey'),
});

export const S3_BUCKET = new Secret({
  name: 'S3_BUCKET',
  hint: 'S3-compatible object storage bucket name',
  pushToApiWorker: true,
  validate: (input) => validateS3NonEmpty(input, 'S3_BUCKET'),
  seed: (input) => seedS3Field(input, 'bucket'),
});

export const S3_ENDPOINT = new Secret({
  name: 'S3_ENDPOINT',
  hint: 'S3-compatible API endpoint, e.g. https://<ACCOUNT_ID>.r2.cloudflarestorage.com',
  pushToApiWorker: true,
  validate: async (input) => {
    requireHttpsUrl(input.secretValue, 'S3_ENDPOINT');
  },
  seed: (input) => seedS3Field(input, 'endpoint'),
});

export const S3_REGION = new Secret({
  name: 'S3_REGION',
  hint: 'S3-compatible region slug — use `auto` for Cloudflare R2',
  pushToApiWorker: true,
  validate: (input) => validateS3NonEmpty(input, 'S3_REGION'),
  seed: (input) => seedS3Field(input, 'region'),
});
