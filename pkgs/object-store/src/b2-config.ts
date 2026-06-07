/** Doppler keys for Backblaze B2 (S3-compatible) object storage. */
export const B2DopplerKey = {
  applicationKeyId: 'B2_APPLICATION_KEY_ID',
  applicationKey: 'B2_APPLICATION_KEY',
  bucketName: 'B2_BUCKET_NAME',
  /** e.g. `https://s3.us-west-004.backblazeb2.com` */
  s3Endpoint: 'B2_S3_ENDPOINT',
  /** e.g. `us-west-004` */
  s3Region: 'B2_S3_REGION',
} as const;

export type B2ObjectStoreConfig = {
  readonly applicationKeyId: string;
  readonly applicationKey: string;
  readonly bucketName: string;
  readonly s3Endpoint: string;
  readonly s3Region: string;
};
