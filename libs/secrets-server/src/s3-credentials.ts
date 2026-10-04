import {
  HeadBucketCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import { requireHttpsUrl, requireNonEmpty, Secret } from '@libs/secrets-shared/secret';
import type { SecretInput } from '@libs/secrets-shared/secret';

async function probeAppKeyAccess(input: SecretInput): Promise<void> {
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
      // Some S3-compatible providers return opaque HeadBucket errors;
      // fall back to a cheap list probe.
    }
    await client.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 }));
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

export const S3_ACCESS_KEY_ID = new Secret({
  name: 'S3_ACCESS_KEY_ID',
  hint: 'S3-compatible access key ID (R2 API token id) for the API Worker object store',
  pushToApiWorker: true,
  validate: probeAppKeyAccess,
  managedBy: 'tofu',
});

export const S3_SECRET_ACCESS_KEY = new Secret({
  name: 'S3_SECRET_ACCESS_KEY',
  hint: 'S3-compatible secret access key (SHA-256 of R2 API token value)',
  pushToApiWorker: true,
  validate: (input) => validateS3NonEmpty(input, 'S3_SECRET_ACCESS_KEY'),
  managedBy: 'tofu',
});

export const S3_BUCKET = new Secret({
  name: 'S3_BUCKET',
  hint: 'S3-compatible object storage bucket name',
  pushToApiWorker: true,
  validate: (input) => validateS3NonEmpty(input, 'S3_BUCKET'),
  managedBy: 'tofu',
});

export const S3_ENDPOINT = new Secret({
  name: 'S3_ENDPOINT',
  hint: 'S3-compatible API endpoint, e.g. https://<accountid>.r2.cloudflarestorage.com',
  pushToApiWorker: true,
  validate: async (input) => {
    requireHttpsUrl(input.secretValue, 'S3_ENDPOINT');
  },
  managedBy: 'tofu',
});

export const S3_REGION = new Secret({
  name: 'S3_REGION',
  hint: 'S3-compatible region slug — use auto for Cloudflare R2',
  pushToApiWorker: true,
  validate: (input) => validateS3NonEmpty(input, 'S3_REGION'),
  managedBy: 'tofu',
});
