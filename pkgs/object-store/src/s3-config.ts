/** Secret names for S3-compatible object storage. */
export const S3SecretName = {
  accessKeyId: 'B2_APP_KEY_ID',
  secretAccessKey: 'B2_APP_KEY',
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
  /** Wire-key root prefix (e.g. `gamezilla/`). Injected at the composition root. */
  readonly rootPrefix: string;
};
