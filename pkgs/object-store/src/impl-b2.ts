import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import type { B2ObjectStoreConfig } from './b2-config';
import { ObjectStoreWithPrefix } from './impl-with-prefix';
import type { ObjectStore, StoredObject } from './interface';
import { ObjectStoreNamespace } from './prefixes';

const DEFAULT_CONTENT_TYPE = 'application/octet-stream';

function isS3NotFound(err: unknown): boolean {
  if (err === null || typeof err !== 'object') return false;
  if ('name' in err && err.name === 'NotFound') return true;
  if ('$metadata' in err) {
    const meta = err.$metadata;
    if (
      meta !== null &&
      typeof meta === 'object' &&
      'httpStatusCode' in meta &&
      meta.httpStatusCode === 404
    ) {
      return true;
    }
  }
  return false;
}

async function readTransformableBody(body: {
  transformToByteArray: () => Promise<Uint8Array | ArrayBuffer>;
}): Promise<Uint8Array> {
  const bytes = await body.transformToByteArray();
  return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
}

function isTransformableBody(
  body: unknown
): body is { transformToByteArray: () => Promise<Uint8Array | ArrayBuffer> } {
  return (
    typeof body === 'object' &&
    body !== null &&
    'transformToByteArray' in body &&
    typeof body.transformToByteArray === 'function'
  );
}

async function bodyToBytes(body: unknown): Promise<Uint8Array> {
  if (body === null || body === undefined) {
    return new Uint8Array();
  }
  if (isTransformableBody(body)) {
    return readTransformableBody(body);
  }
  if (body instanceof ReadableStream) {
    return readStreamBytes(body);
  }
  if (body instanceof Uint8Array) {
    return body;
  }
  if (body instanceof ArrayBuffer) {
    return new Uint8Array(body);
  }
  throw new Error('ObjectStoreImplB2: unsupported S3 response body type');
}

async function readStreamBytes(
  stream: ReadableStream<Uint8Array>
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value !== undefined) {
      chunks.push(value);
      total += value.byteLength;
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

function bytesStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  const copy = new Uint8Array(bytes);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(copy);
      controller.close();
    },
  });
}

/**
 * Low-level {@link ObjectStore} backed by Backblaze B2's S3-compatible API.
 * Keys are passed through verbatim — callers must not use this directly;
 * compose via {@link createB2ObjectStore} so every key is scoped under
 * {@link ObjectStoreNamespace.root}.
 */
class ObjectStoreImplB2S3 implements ObjectStore {
  private readonly client: S3Client;

  constructor(
    private readonly bucketName: string,
    config: B2ObjectStoreConfig
  ) {
    this.client = new S3Client({
      region: config.s3Region,
      endpoint: config.s3Endpoint,
      credentials: {
        accessKeyId: config.applicationKeyId,
        secretAccessKey: config.applicationKey,
      },
      forcePathStyle: true,
    });
  }

  async get(key: string): Promise<StoredObject | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucketName, Key: key })
      );
      const bytes = await bodyToBytes(response.Body);
      const contentType =
        typeof response.ContentType === 'string' &&
        response.ContentType.length > 0
          ? response.ContentType
          : DEFAULT_CONTENT_TYPE;
      const size =
        typeof response.ContentLength === 'number'
          ? response.ContentLength
          : bytes.byteLength;
      return {
        body: bytesStream(bytes),
        contentType,
        size,
      };
    } catch (err: unknown) {
      if (isS3NotFound(err)) return null;
      throw err;
    }
  }

  async put(
    key: string,
    bytes: Uint8Array,
    contentType: string
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: bytes,
        ContentType: contentType,
      })
    );
  }

  async head(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucketName, Key: key })
      );
      return true;
    } catch (err: unknown) {
      if (isS3NotFound(err)) return false;
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucketName, Key: key })
      );
    } catch (err: unknown) {
      if (isS3NotFound(err)) return;
      throw err;
    }
  }

  async getUri(_key: string): Promise<string | null> {
    return null;
  }

  withPrefix(prefix: string): ObjectStore {
    return new ObjectStoreWithPrefix(this, prefix);
  }
}

/**
 * Returns a B2-backed {@link ObjectStore} with {@link ObjectStoreNamespace.root}
 * applied. This is the only supported entry point for remote object storage —
 * feature code receives logical keys; the wrapper maps them to
 * `gamezilla/<feature>/…` in the bucket.
 */
export function createB2ObjectStore(config: B2ObjectStoreConfig): ObjectStore {
  return new ObjectStoreWithPrefix(
    new ObjectStoreImplB2S3(config.bucketName, config),
    ObjectStoreNamespace.root
  );
}
