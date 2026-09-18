/// <reference path="./s3rver.d.ts" />
import S3rver from 's3rver';

export const S3_ACCESS_KEY_ID = 'S3RVER';
export const S3_SECRET_ACCESS_KEY = 'S3RVER';
export const S3_BUCKET = 'test-bucket';
export const S3_REGION = 'us-east-1';

export type S3ServerHandle = {
  readonly endpoint: string;
  stop(): Promise<void>;
};

export type StartS3ServerOptions = {
  readonly directory: string;
  readonly port?: number;
};

export async function startS3Server(
  options: StartS3ServerOptions
): Promise<S3ServerHandle> {
  const server = new S3rver({
    port: options.port ?? 0,
    address: 'localhost',
    silent: true,
    directory: options.directory,
    configureBuckets: [{ name: S3_BUCKET }],
  });
  const { port } = await server.run();
  return {
    endpoint: `http://localhost:${String(port)}`,
    stop: async () => {
      await server.close();
    },
  };
}
