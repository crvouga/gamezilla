// @io-wall-ok
/**
 * Create the local app bucket once MinIO is accepting S3 API requests.
 */
import {
  CreateBucketCommand,
  HeadBucketCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  MINIO_BUCKET,
  MINIO_ENDPOINT,
  MINIO_REGION,
  MINIO_ROOT_PASSWORD,
  MINIO_ROOT_USER,
} from './ports';

function createClient(): S3Client {
  return new S3Client({
    region: MINIO_REGION,
    endpoint: MINIO_ENDPOINT,
    credentials: {
      accessKeyId: MINIO_ROOT_USER,
      secretAccessKey: MINIO_ROOT_PASSWORD,
    },
    forcePathStyle: true,
  });
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** Poll until MinIO answers HeadBucket / CreateBucket. */
export async function waitForMinioReady(
  timeoutMs: number = 60_000
): Promise<void> {
  const started = Date.now();
  let attempt = 0;
  let lastError: unknown = null;
  while (Date.now() - started < timeoutMs) {
    attempt += 1;
    const client = createClient();
    try {
      await client.send(new HeadBucketCommand({ Bucket: MINIO_BUCKET }));
      client.destroy();
      return;
    } catch (error) {
      lastError = error;
      // Bucket missing is fine — API is up.
      const name =
        error !== null && typeof error === 'object' && 'name' in error
          ? String(error.name)
          : '';
      const status =
        error !== null &&
        typeof error === 'object' &&
        '$metadata' in error &&
        error.$metadata !== null &&
        typeof error.$metadata === 'object' &&
        'httpStatusCode' in error.$metadata
          ? Number(error.$metadata.httpStatusCode)
          : 0;
      if (name === 'NotFound' || status === 404) {
        client.destroy();
        return;
      }
      client.destroy();
      if (attempt === 1 || attempt % 5 === 0) {
        process.stdout.write(
          `[minio] waiting for S3 API (attempt ${String(attempt)})…\n`
        );
      }
      await sleep(500);
    }
  }
  throw new Error(
    `MinIO did not become ready within ${String(timeoutMs)}ms: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}

export async function ensureLocalBucket(): Promise<void> {
  const client = createClient();
  try {
    try {
      await client.send(new HeadBucketCommand({ Bucket: MINIO_BUCKET }));
      process.stdout.write(`[minio] bucket ${MINIO_BUCKET} already exists\n`);
      return;
    } catch {
      // create below
    }
    await client.send(new CreateBucketCommand({ Bucket: MINIO_BUCKET }));
    process.stdout.write(`[minio] created bucket ${MINIO_BUCKET}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/already|owned|BucketAlready/i.test(message)) {
      process.stdout.write(`[minio] bucket ${MINIO_BUCKET} already exists\n`);
      return;
    }
    throw error;
  } finally {
    client.destroy();
  }
}
