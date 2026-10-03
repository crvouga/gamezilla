// @io-wall-ok — local sidecar server composition root.
import { createServer } from '@crvouga/mockingbird-service-s3/server';

export const S3_ACCESS_KEY_ID = 'fixture';
export const S3_SECRET_ACCESS_KEY = 'fixture';
export const S3_BUCKET = 'test-bucket';
export const S3_REGION = 'us-east-1';

export type S3ServerHandle = {
  readonly endpoint: string;
  stop(): Promise<void>;
};

export type StartS3ServerOptions = {
  readonly port?: number;
};

export async function startS3Server(
  options: StartS3ServerOptions = {}
): Promise<S3ServerHandle> {
  const server = await createServer({
    port: options.port ?? 0,
    host: 'localhost',
    buckets: [S3_BUCKET],
    credentials: { [S3_ACCESS_KEY_ID]: S3_SECRET_ACCESS_KEY },
  });
  return {
    endpoint: server.url,
    stop: async () => {
      await server.close();
    },
  };
}
