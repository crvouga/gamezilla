/**
 * Local MinIO ObjectStore for playground snapshots (browser → S3).
 * Dev-only credentials — never use outside SECRETS_ENV=dev playground.
 * Falls back to in-memory when MinIO construct fails; ops time out so boot
 * / palette never hang on a down MinIO.
 */

import type { Timers } from '@pkgs/clock';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import { createS3ObjectStore } from '@pkgs/object-store/impl-s3';
import type { ObjectStore } from '@pkgs/object-store/interface';
import { ObjectStorePrefix } from '@pkgs/object-store/prefixes';

const MINIO_ENDPOINT = 'http://127.0.0.1:9000';
const MINIO_BUCKET = 'local';
const MINIO_REGION = 'us-east-1';
const MINIO_USER = 'minioadmin';
const MINIO_PASSWORD = 'minioadmin';
const ROOT_PREFIX = 'gamezilla/';
const S3_OP_TIMEOUT_MS = 2_500;

function withTimeout<T>(
  timers: Timers,
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = timers.setTimeout(() => {
      reject(new Error(`playground snapshot store timed out (${label})`));
    }, ms);
    promise.then(
      (v) => {
        timers.clearTimeout(t);
        resolve(v);
      },
      (e) => {
        timers.clearTimeout(t);
        reject(e);
      }
    );
  });
}

function wrapWithTimeout(inner: ObjectStore, timers: Timers): ObjectStore {
  return {
    get: (key) =>
      withTimeout(timers, inner.get(key), S3_OP_TIMEOUT_MS, `get ${key}`),
    put: (key, bytes, contentType) =>
      withTimeout(
        timers,
        inner.put(key, bytes, contentType),
        S3_OP_TIMEOUT_MS,
        `put ${key}`
      ),
    head: (key) =>
      withTimeout(timers, inner.head(key), S3_OP_TIMEOUT_MS, `head ${key}`),
    delete: (key) =>
      withTimeout(timers, inner.delete(key), S3_OP_TIMEOUT_MS, `delete ${key}`),
    getUri: (key) => inner.getUri(key),
    listKeys: (prefix) =>
      withTimeout(
        timers,
        inner.listKeys(prefix),
        S3_OP_TIMEOUT_MS,
        `list ${prefix ?? ''}`
      ),
    withPrefix: (prefix) => wrapWithTimeout(inner.withPrefix(prefix), timers),
  };
}

/**
 * Prefer MinIO; if construct fails, use memory.
 * Pass wall timers from the playground composition root so S3 timeouts
 * are not tied to the sim clock.
 */
export function createPlaygroundSnapshotStore(timers: Timers): ObjectStore {
  try {
    const s3 = createS3ObjectStore({
      accessKeyId: MINIO_USER,
      secretAccessKey: MINIO_PASSWORD,
      bucket: MINIO_BUCKET,
      endpoint: MINIO_ENDPOINT,
      region: MINIO_REGION,
      rootPrefix: ROOT_PREFIX,
    }).withPrefix(ObjectStorePrefix.playgroundSnapshots);
    return wrapWithTimeout(s3, timers);
  } catch {
    return new ObjectStoreImplInMemory().withPrefix(
      ObjectStorePrefix.playgroundSnapshots
    );
  }
}
