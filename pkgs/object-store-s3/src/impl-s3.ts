import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { ObjectStoreWithPrefix } from '@pkgs/object-store/impl-with-prefix';
import type { ObjectStore, StoredObject } from '@pkgs/object-store/interface';
import { assertRemoteObjectKey } from '@pkgs/object-store/namespace-guard';
import { normalizeObjectStoreRootPrefix } from '@pkgs/object-store/prefixes';
import type { S3ObjectStoreConfig } from './s3-config';

const DEFAULT_CONTENT_TYPE = 'application/octet-stream';

function s3HttpStatus(err: unknown): number | undefined {
  if (err === null || typeof err !== 'object' || !('$metadata' in err)) {
    return undefined;
  }
  const meta = err.$metadata;
  if (
    meta === null ||
    typeof meta !== 'object' ||
    !('httpStatusCode' in meta)
  ) {
    return undefined;
  }
  return typeof meta.httpStatusCode === 'number'
    ? meta.httpStatusCode
    : undefined;
}

function isS3NotFound(err: unknown): boolean {
  if (err === null || typeof err !== 'object') return false;
  if ('name' in err && err.name === 'NotFound') return true;
  return s3HttpStatus(err) === 404;
}

/** MinIO + browser SDK sometimes answers DeleteObject on absent keys with 403. */
function isS3AccessDenied(err: unknown): boolean {
  if (err === null || typeof err !== 'object') return false;
  if (
    'name' in err &&
    (err.name === 'AccessDenied' || err.name === 'Forbidden')
  ) {
    return true;
  }
  if ('Code' in err && err.Code === 'AccessDenied') return true;
  return s3HttpStatus(err) === 403;
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
  throw new Error('ObjectStoreImplS3: unsupported S3 response body type');
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
 * Low-level {@link ObjectStore} backed by an S3-compatible API.
 * Keys are passed through verbatim — callers must not use this directly;
 * compose via {@link createS3ObjectStore} so every key is scoped under an
 * injected root prefix.
 */
class ObjectStoreImplS3 implements ObjectStore {
  private readonly client: S3Client;
  private readonly namespace: string;

  constructor(
    private readonly bucket: string,
    config: S3ObjectStoreConfig
  ) {
    this.namespace = normalizeObjectStoreRootPrefix(config.rootPrefix);
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true,
      // MinIO / older S3-compat reject default flexible checksums (501).
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      // Directory-bucket session auth is AWS-only; keep SigV4 for MinIO/R2.
      disableS3ExpressSessionAuth: true,
    });
  }

  private guardKey(key: string): void {
    assertRemoteObjectKey(key, this.namespace);
  }

  async get(key: string): Promise<StoredObject | null> {
    this.guardKey(key);
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key })
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
    this.guardKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: bytes,
        ContentType: contentType,
      })
    );
  }

  async head(key: string): Promise<boolean> {
    this.guardKey(key);
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key })
      );
      return true;
    } catch (err: unknown) {
      if (isS3NotFound(err)) return false;
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    this.guardKey(key);
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
      );
    } catch (err: unknown) {
      if (isS3NotFound(err)) return;
      if (isS3AccessDenied(err)) {
        // Idempotent delete: if the object is already gone, treat as success.
        try {
          if (!(await this.head(key))) return;
        } catch {
          // Keep the original AccessDenied when presence cannot be confirmed.
        }
      }
      throw err;
    }
  }

  async getUri(_key: string): Promise<string | null> {
    return null;
  }

  async listKeys(prefix = ''): Promise<readonly string[]> {
    const listPrefix = prefix.length > 0 ? prefix : this.namespace;
    if (
      !listPrefix.startsWith(this.namespace) &&
      listPrefix !== this.namespace
    ) {
      throw new Error(
        `ObjectStoreImplS3: listKeys prefix must start with "${this.namespace}": ${listPrefix}`
      );
    }
    const keys: string[] = [];
    let continuationToken: string | undefined;
    for (;;) {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: listPrefix,
          ContinuationToken: continuationToken,
        })
      );
      for (const obj of response.Contents ?? []) {
        if (typeof obj.Key === 'string' && obj.Key.length > 0) {
          keys.push(obj.Key);
        }
      }
      if (!response.IsTruncated) break;
      continuationToken = response.NextContinuationToken;
    }
    return keys.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }

  withPrefix(_prefix: string): ObjectStore {
    throw new Error(
      'S3 transport does not support withPrefix; call withPrefix on createS3ObjectStore() result'
    );
  }
}

/**
 * Returns an S3-backed {@link ObjectStore} with the configured root prefix
 * applied. Feature code receives logical keys; the wrapper maps them to
 * `<rootPrefix><feature>/…` in the bucket.
 */
export function createS3ObjectStore(config: S3ObjectStoreConfig): ObjectStore {
  const rootPrefix = normalizeObjectStoreRootPrefix(config.rootPrefix);
  return new ObjectStoreWithPrefix(
    new ObjectStoreImplS3(config.bucket, config),
    rootPrefix
  );
}
