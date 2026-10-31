import type { HttpClient } from '@pkgs/http-client-shared-ts/types';

/** Secret names for S3-compatible object storage. */
export const S3SecretName = {
  accessKeyId: 'S3_ACCESS_KEY_ID',
  secretAccessKey: 'S3_SECRET_ACCESS_KEY',
  bucket: 'S3_BUCKET',
  endpoint: 'S3_ENDPOINT',
  region: 'S3_REGION',
} as const;

export type S3ObjectStoreConfig = {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly bucket: string;
  readonly endpoint: string;
  readonly region: string;
  /** Wire-key root prefix (e.g. `acme/`). Injected at the composition root. */
  readonly rootPrefix: string;
  /** Transport for every S3 request (wall client, or a mock fetch handler). */
  readonly http: HttpClient;
};
