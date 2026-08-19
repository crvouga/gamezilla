/** Local MinIO S3 API port. */
export const MINIO_API_PORT = 9000;
/** Local MinIO web console port. */
export const MINIO_CONSOLE_PORT = 9001;

export const MINIO_LOCAL_PORTS = [MINIO_API_PORT, MINIO_CONSOLE_PORT] as const;

/** Root credentials — written into `@apps/api` `.dev.vars` as B2_APP_* / S3_*. */
export const MINIO_ROOT_USER = 'minioadmin';
export const MINIO_ROOT_PASSWORD = 'minioadmin';

export const MINIO_BUCKET = 'local';
export const MINIO_REGION = 'us-east-1';

export const MINIO_ENDPOINT =
  `http://127.0.0.1:${String(MINIO_API_PORT)}` as const;

/**
 * Pinned community MinIO binary from dl.min.io archive.
 * @see https://dl.min.io/server/minio/release/
 */
export const MINIO_RELEASE = 'RELEASE.2025-09-07T16-13-09Z';
