import { ObjectStoreWithPrefix } from './impl-with-prefix';
import type { ObjectStore, StoredObject } from './interface';
import { assertLogicalObjectKey } from './namespace-guard';

/** Injectable fetch for the HTTP ObjectStore (browser / Bun / test stub). */
export type ObjectStoreHttpFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export type CreateHttpObjectStoreOptions = {
  /** Base URL ending without trailing slash, e.g. `http://127.0.0.1:7789/api/…/objects`. */
  readonly baseUrl: string;
  /** Injected fetch (browser / Bun / test stub). */
  readonly fetch: ObjectStoreHttpFetch;
};

function trimTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function objectUrl(baseUrl: string, key: string): string {
  assertLogicalObjectKey(key);
  const segments = key.split('/').map((s) => encodeURIComponent(s));
  return `${baseUrl}/${segments.join('/')}`;
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const text = await res.text();
    if (text.length === 0) return res.statusText || String(res.status);
    try {
      const parsed = JSON.parse(text) as { error?: string };
      if (typeof parsed.error === 'string' && parsed.error.length > 0) {
        return parsed.error;
      }
    } catch {
      // not JSON
    }
    return text;
  } catch {
    return res.statusText || String(res.status);
  }
}

/**
 * {@link ObjectStore} over HTTP — browser clients talk to a Bun/Node proxy that
 * holds S3 credentials. `getUri` always returns `null` (same as S3).
 */
export class ObjectStoreImplHttp implements ObjectStore {
  private readonly baseUrl: string;
  private readonly fetchFn: ObjectStoreHttpFetch;

  constructor(options: CreateHttpObjectStoreOptions) {
    this.baseUrl = trimTrailingSlash(options.baseUrl);
    this.fetchFn = options.fetch;
  }

  async get(key: string): Promise<StoredObject | null> {
    const res = await this.fetchFn(objectUrl(this.baseUrl, key), {
      method: 'GET',
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(
        `ObjectStore HTTP get failed (${String(res.status)}): ${await readErrorMessage(res)}`
      );
    }
    const contentType =
      res.headers.get('content-type') ?? 'application/octet-stream';
    const buf = new Uint8Array(await res.arrayBuffer());
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(buf);
        controller.close();
      },
    });
    return { body, contentType, size: buf.byteLength };
  }

  async put(
    key: string,
    bytes: Uint8Array,
    contentType: string
  ): Promise<void> {
    const ab = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(ab).set(bytes);
    const res = await this.fetchFn(objectUrl(this.baseUrl, key), {
      method: 'PUT',
      headers: { 'content-type': contentType },
      body: ab,
    });
    if (!res.ok) {
      throw new Error(
        `ObjectStore HTTP put failed (${String(res.status)}): ${await readErrorMessage(res)}`
      );
    }
  }

  async head(key: string): Promise<boolean> {
    const res = await this.fetchFn(objectUrl(this.baseUrl, key), {
      method: 'HEAD',
    });
    if (res.status === 404) return false;
    if (!res.ok) {
      throw new Error(
        `ObjectStore HTTP head failed (${String(res.status)}): ${await readErrorMessage(res)}`
      );
    }
    return true;
  }

  async delete(key: string): Promise<void> {
    const res = await this.fetchFn(objectUrl(this.baseUrl, key), {
      method: 'DELETE',
    });
    if (res.status === 404 || res.ok) return;
    throw new Error(
      `ObjectStore HTTP delete failed (${String(res.status)}): ${await readErrorMessage(res)}`
    );
  }

  async getUri(_key: string): Promise<string | null> {
    return null;
  }

  async listKeys(prefix = ''): Promise<readonly string[]> {
    const url = new URL(this.baseUrl);
    url.searchParams.set('list', '1');
    if (prefix.length > 0) url.searchParams.set('prefix', prefix);
    const res = await this.fetchFn(url.toString(), { method: 'GET' });
    if (!res.ok) {
      throw new Error(
        `ObjectStore HTTP listKeys failed (${String(res.status)}): ${await readErrorMessage(res)}`
      );
    }
    const body = (await res.json()) as { keys?: unknown };
    if (!Array.isArray(body.keys)) {
      throw new Error('ObjectStore HTTP listKeys: response missing keys array');
    }
    return body.keys.map((k) => {
      if (typeof k !== 'string') {
        throw new Error('ObjectStore HTTP listKeys: non-string key');
      }
      return k;
    });
  }

  withPrefix(prefix: string): ObjectStore {
    return new ObjectStoreWithPrefix(this, prefix);
  }
}

export function createHttpObjectStore(
  options: CreateHttpObjectStoreOptions
): ObjectStore {
  return new ObjectStoreImplHttp(options);
}
