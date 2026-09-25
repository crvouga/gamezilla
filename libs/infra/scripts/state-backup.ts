// @io-wall-ok — CLI helper: server-side copy of the state object before apply.
/**
 * Before every apply, copy the environment's state object to
 * `backups/<stack>/<env>/<timestamp>.tfstate` in the same bucket. It is a
 * server-side copy of the already-encrypted object: the backup is exactly as
 * protected as the state, and a corrupted apply can be rolled back by copying
 * it back. The first apply of a new environment has nothing to back up.
 */
import {
  CopyObjectCommand,
  HeadObjectCommand,
  NotFound,
  S3Client,
} from '@aws-sdk/client-s3';
import { GLOBAL } from '@libs/infra/public/global';
import type { Target } from '@libs/infra/public/tofu-command';

export async function backupState(input: {
  readonly target: Target;
  readonly env: Readonly<Record<string, string>>;
}): Promise<void> {
  const { target, env } = input;
  const scope = target.env ?? 'global';
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${GLOBAL.state.account_id}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env['AWS_ACCESS_KEY_ID'] ?? '',
      secretAccessKey: env['AWS_SECRET_ACCESS_KEY'] ?? '',
    },
  });
  const bucket = GLOBAL.state.bucket;
  const key = `${target.stack}/${scope}.tfstate`;
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  } catch (error) {
    if (error instanceof NotFound) {
      console.log(`[infra] ${key}: no state yet, nothing to back up`);
      return;
    }
    throw error;
  }
  const stamp = new Date().toISOString().replaceAll(':', '-');
  const backupKey = `backups/${target.stack}/${scope}/${stamp}.tfstate`;
  await client.send(
    new CopyObjectCommand({
      Bucket: bucket,
      Key: backupKey,
      CopySource: `${bucket}/${key}`,
    })
  );
  console.log(`[infra] state backed up to ${bucket}/${backupKey}`);
}
