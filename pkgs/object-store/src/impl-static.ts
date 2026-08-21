/**
 * Read-only {@link ObjectStore} over static HTTP URLs (Expo `public/` bundle).
 *
 * `get` / `head` / `getUri` fetch `${baseUrl}/${key}`. Writes throw.
 * `listKeys` reads a committed `keys.json` (array of strings) because static
 * servers cannot directory-list.
 */

import { ObjectStoreWithPrefix } from './impl-with-prefix';
import type { ObjectStore, StoredObject } from './interface';
import { assertLogicalObjectKey } from './namespace-guard';

const DEFAULT_CONTENT_TYPE = 'application/octet-stream';
const KEYS_INDEX = 'keys.json';

/** Injectable fetch (browser / Bun / test stub). */
export type ObjectStoreStaticFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export type CreateStaticObjectStoreOptions = {
  /**
   * Base URL without trailing slash, e.g. `/reports` or
   * `http://localhost:5173/reports`.
   */
  readonly baseUrl: string;
  readonly fetch: ObjectStoreStaticFetch;
  /** Index key listing all objects (default `keys.json`). */
  readonly keysIndex?: string;
};

function trimTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function objectUrl(baseUrl: string, key: string): string {
  assertLogicalObjectKey(key);
  const segments = key.split('/').map((s) => encodeURIComponent(s));
  return `${baseUrl}/${segments.join('/')}`;
}

function guessContentType(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.html')) return 'text/html';
  if (lower.endsWith('.css')) return 'text/css';
  if (lower.endsWith('.sqlm')) return 'application/octet-stream';
  if (lower.endsWith('.txt') || lower.endsWith('.ndjson'))
    return 'text/plain; charset=utf-8';
  return DEFAULT_CONTENT_TYPE;
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
 * Read-only ObjectStore backed by static files under `baseUrl`.
 */
export class ObjectStoreImplStatic implements ObjectStore {
  private readonly baseUrl: string;
  private readonly fetchFn: ObjectStoreStaticFetch;
  private readonly keysIndex: string;

  constructor(options: CreateStaticObjectStoreOptions) {
    this.baseUrl = trimTrailingSlash(options.baseUrl);
    this.fetchFn = options.fetch;
    this.keysIndex = options.keysIndex ?? KEYS_INDEX;
  }

  async get(key: string): Promise<StoredObject | null> {
    const res = await this.fetchFn(objectUrl(this.baseUrl, key), {
      method: 'GET',
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(
        `ObjectStore static get failed (${String(res.status)}) for ${key}`
      );
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    const contentType =
      res.headers.get('content-type')?.split(';')[0]?.trim() ||
      guessContentType(key);
    return {
      body: bytesStream(bytes),
      contentType,
      size: bytes.byteLength,
    };
  }

  async put(
    _key: string,
    _bytes: Uint8Array,
    _contentType: string
  ): Promise<void> {
    throw new Error('ObjectStoreImplStatic: read-only (put not supported)');
  }

  async head(key: string): Promise<boolean> {
    const res = await this.fetchFn(objectUrl(this.baseUrl, key), {
      method: 'HEAD',
    });
    if (res.status === 404) return false;
    if (res.status === 405 || res.status === 501) {
      // Some static servers reject HEAD — fall back to GET.
      const getRes = await this.fetchFn(objectUrl(this.baseUrl, key), {
        method: 'GET',
      });
      return getRes.ok;
    }
    if (!res.ok) {
      throw new Error(
        `ObjectStore static head failed (${String(res.status)}) for ${key}`
      );
    }
    return true;
  }

  async delete(_key: string): Promise<void> {
    throw new Error('ObjectStoreImplStatic: read-only (delete not supported)');
  }

  async getUri(key: string): Promise<string | null> {
    if (!(await this.head(key))) return null;
    return objectUrl(this.baseUrl, key);
  }

  async listKeys(prefix = ''): Promise<readonly string[]> {
    const res = await this.fetchFn(objectUrl(this.baseUrl, this.keysIndex), {
      method: 'GET',
    });
    if (res.status === 404) return [];
    if (!res.ok) {
      throw new Error(
        `ObjectStore static listKeys failed (${String(res.status)})`
      );
    }
    const body: unknown = await res.json();
    const keys = parseKeysIndex(body);
    const filtered =
      prefix.length === 0 ? keys : keys.filter((k) => k.startsWith(prefix));
    return [...filtered].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }

  withPrefix(prefix: string): ObjectStore {
    return new ObjectStoreWithPrefix(this, prefix);
  }
}

export function createStaticObjectStore(
  options: CreateStaticObjectStoreOptions
): ObjectStore {
  return new ObjectStoreImplStatic(options);
}

function parseKeysIndex(body: unknown): readonly string[] {
  if (Array.isArray(body)) {
    return body.map((k) => {
      if (typeof k !== 'string') {
        throw new Error('ObjectStore static keys.json: non-string key');
      }
      return k;
    });
  }
  if (
    body !== null &&
    typeof body === 'object' &&
    Array.isArray((body as { keys?: unknown }).keys)
  ) {
    return (body as { keys: unknown[] }).keys.map((k) => {
      if (typeof k !== 'string') {
        throw new Error('ObjectStore static keys.json: non-string key');
      }
      return k;
    });
  }
  throw new Error(
    'ObjectStore static keys.json: expected string[] or { keys }'
  );
}
