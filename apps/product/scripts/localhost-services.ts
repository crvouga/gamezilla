// @io-wall-ok — Node-conditions sidecar for embedded services and S3 transport.

import { appObjectStoreRootPrefix } from '@libs/db/public/scope';
import {
  MINIO_BUCKET,
  MINIO_ENDPOINT,
  MINIO_REGION,
  MINIO_ROOT_PASSWORD,
  MINIO_ROOT_USER,
} from '@pkgs/minio-server';
import { createS3ObjectStore } from '@pkgs/object-store-s3/impl-s3';
import { bootLocalStack } from '../../../tools/scripts/boot-local-stack';

const stack = await bootLocalStack();
const store = createS3ObjectStore({
  accessKeyId: MINIO_ROOT_USER,
  secretAccessKey: MINIO_ROOT_PASSWORD,
  bucket: MINIO_BUCKET,
  endpoint: MINIO_ENDPOINT,
  region: MINIO_REGION,
  rootPrefix: appObjectStoreRootPrefix(),
});

async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const key = url.searchParams.get('key') ?? '';
  try {
    if (url.pathname === '/object') {
      if (req.method === 'GET') {
        const found = await store.get(key);
        return found === null
          ? new Response(null, { status: 404 })
          : new Response(found.body, {
              headers: {
                'content-type': found.contentType,
                'content-length': String(found.size),
              },
            });
      }
      if (req.method === 'HEAD') {
        return new Response(null, {
          status: (await store.head(key)) ? 200 : 404,
        });
      }
      if (req.method === 'PUT') {
        await store.put(
          key,
          new Uint8Array(await req.arrayBuffer()),
          req.headers.get('content-type') ?? 'application/octet-stream'
        );
        return new Response(null, { status: 204 });
      }
      if (req.method === 'DELETE') {
        await store.delete(key);
        return new Response(null, { status: 204 });
      }
    }
    if (url.pathname === '/uri' && req.method === 'GET') {
      return Response.json({ uri: await store.getUri(key) });
    }
    if (url.pathname === '/keys' && req.method === 'GET') {
      return Response.json({
        keys: await store.listKeys(url.searchParams.get('prefix') ?? undefined),
      });
    }
    return new Response(null, { status: 404 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: handle });
process.stdout.write(`LOCALHOST_SERVICES_ORIGIN=${server.url.origin}\n`);
let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  await server.stop(true);
  await stack.stop();
};
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void stop().then(() => process.exit(0));
  });
}
