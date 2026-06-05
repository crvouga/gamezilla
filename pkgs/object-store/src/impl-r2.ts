import type { ObjectStore, StoredObject } from './interface';
import { ObjectStoreWithPrefix } from './impl-with-prefix';

/**
 * Cloudflare R2 binding shape. Declared inline so this package doesn't need
 * `@cloudflare/workers-types` (which conflicts with the DOM types pulled in by
 * the Expo web build that shares the root tsconfig). Mirrors how
 * {@link ../sql-client/impl-d1.ts} declares `D1Database` for the same reason.
 *
 * Only the methods we actually use are typed; any caller can pass an
 * `env.<BUCKET>` binding directly.
 */
export interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | ReadableStream | string | null,
    options?: R2PutOptions
  ): Promise<R2Object | null>;
  head(key: string): Promise<R2Object | null>;
  delete(key: string | string[]): Promise<void>;
}

export interface R2PutOptions {
  httpMetadata?: { contentType?: string };
  customMetadata?: Record<string, string>;
}

export interface R2Object {
  key: string;
  size: number;
  httpMetadata?: { contentType?: string };
  customMetadata?: Record<string, string>;
}

export interface R2ObjectBody extends R2Object {
  body: ReadableStream<Uint8Array>;
  bodyUsed: boolean;
  arrayBuffer(): Promise<ArrayBuffer>;
}

const DEFAULT_CONTENT_TYPE = 'application/octet-stream';

/**
 * {@link ObjectStore} backed by a Cloudflare R2 bucket binding. Round-trips
 * `contentType` through `httpMetadata.contentType`. R2's native API is already
 * "missing → null", so the adapter is a thin shim.
 */
export class ObjectStoreImplR2 implements ObjectStore {
  constructor(private readonly bucket: R2Bucket) {}

  async get(key: string): Promise<StoredObject | null> {
    const obj = await this.bucket.get(key);
    if (obj === null) return null;
    return {
      body: obj.body,
      contentType: obj.httpMetadata?.contentType ?? DEFAULT_CONTENT_TYPE,
      size: obj.size,
    };
  }

  async put(
    key: string,
    bytes: Uint8Array,
    contentType: string
  ): Promise<void> {
    await this.bucket.put(key, bytes, {
      httpMetadata: { contentType },
    });
  }

  async head(key: string): Promise<boolean> {
    const obj = await this.bucket.head(key);
    return obj !== null;
  }

  async delete(key: string): Promise<void> {
    await this.bucket.delete(key);
  }

  /**
   * R2 has no public direct URL from the worker binding — the API Worker
   * streams bytes back through Hono (`/tts/audio/:hash`). Returning `null`
   * forces callers down the byte-streaming path via {@link ObjectStore.get}.
   */
  async getUri(_key: string): Promise<string | null> {
    return null;
  }
}
