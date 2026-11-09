// @io-wall-ok — CLI helper: releases a state lock no running job can hold.
/**
 * A runner that dies while OpenTofu holds the state lock leaves the lock
 * object behind, and every later apply fails at "Error acquiring the state
 * lock". Before an apply takes the lock, read the lock object; when a
 * GitHub-hosted runner wrote it longer ago than any hosted job may run
 * (`abandonedLockId`), its job has ended, so release it with the exact ID.
 */
import { GetObjectCommand, NoSuchKey, S3Client } from '@aws-sdk/client-s3';
import { GLOBAL } from '@libs/infra-shared-ts/global';
import {
  initArgs,
  stackDir,
  type Target,
  type TofuPaths,
} from '@libs/infra-shared-ts/tofu-command';
import {
  abandonedLockId,
  stateLockKey,
  stateUnlockArgs,
} from '@libs/infra-shared-ts/tofu-process-policy';
import { fail, tofu, tofuInit } from './tofu-process';

async function readLockObject(
  key: string,
  env: Readonly<Record<string, string>>
): Promise<string | null> {
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${GLOBAL.state.account_id}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env['AWS_ACCESS_KEY_ID'] ?? '',
      secretAccessKey: env['AWS_SECRET_ACCESS_KEY'] ?? '',
    },
  });
  try {
    const object = await client.send(
      new GetObjectCommand({ Bucket: GLOBAL.state.bucket, Key: key })
    );
    return (await object.Body?.transformToString()) ?? null;
  } catch (error) {
    if (error instanceof NoSuchKey) return null;
    throw error;
  }
}

export async function releaseAbandonedLock(input: {
  readonly paths: TofuPaths;
  readonly target: Target;
  readonly env: Record<string, string>;
  readonly now: Date;
}): Promise<void> {
  const { paths, target, env } = input;
  const key = stateLockKey(target);
  const lock = await readLockObject(key, env);
  if (lock === null) return;
  const id = abandonedLockId(lock, input.now);
  if (id === null) {
    console.log(`[infra] ${key}: held, and may still be live; leaving it`);
    return;
  }
  console.log(
    `[infra] ${key}: lock ${id} outlived every hosted job; releasing it`
  );
  if ((await tofuInit(initArgs(paths, target), env)) !== 0)
    fail(`${target.stack}: tofu init failed`);
  const args = stateUnlockArgs(id, paths, target);
  if (tofu([`-chdir=${stackDir(paths, target.stack)}`, ...args], env) !== 0)
    fail(`${key}: releasing abandoned lock ${id} failed`);
}
