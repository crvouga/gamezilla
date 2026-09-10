/**
 * HTTP ObjectStore proxy for product-simulator snapshots.
 * Bun local report servers hold the backing store (Node-FS locally);
 * The web bundle uses impl-http against this proxy.
 */

import { readBytes } from '@pkgs/object-store/helpers';
import type { ObjectStore } from '@pkgs/object-store/interface';

import { PRODUCT_SIMULATOR_SNAPSHOT_OBJECTS_PATH } from '../types';

export { PRODUCT_SIMULATOR_SNAPSHOT_OBJECTS_PATH };

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function storeError(err: unknown): Response {
  const message = err instanceof Error ? err.message : String(err);
  return json({ error: message }, 502);
}

function decodeObjectKey(pathname: string): string | null {
  if (!pathname.startsWith(`${PRODUCT_SIMULATOR_SNAPSHOT_OBJECTS_PATH}/`)) {
    return null;
  }
  const raw = pathname.slice(
    PRODUCT_SIMULATOR_SNAPSHOT_OBJECTS_PATH.length + 1
  );
  if (raw.length === 0) return null;
  try {
    return raw
      .split('/')
      .map((s) => decodeURIComponent(s))
      .join('/');
  } catch {
    return null;
  }
}

/**
 * Handle `/api/product-simulator-snapshots/objects` requests.
 * Returns `null` when the path is not for this proxy.
 *
 * When `store` is `null`, every matched request returns 503 with a clear error.
 * Store throws become JSON 502 with the underlying message.
 */
export async function handleProductSimulatorSnapshotObjectRequest(
  req: Request,
  store: ObjectStore | null
): Promise<Response | null> {
  const url = new URL(req.url);
  const { pathname } = url;

  if (pathname !== PRODUCT_SIMULATOR_SNAPSHOT_OBJECTS_PATH) {
    if (!pathname.startsWith(`${PRODUCT_SIMULATOR_SNAPSHOT_OBJECTS_PATH}/`)) {
      return null;
    }
  } else if (url.searchParams.get('list') !== '1') {
    return json({ error: 'use ?list=1 to list keys, or append /<key>' }, 400);
  }

  if (store === null) {
    return json({ error: 'ProductSimulator snapshot store unavailable.' }, 503);
  }

  try {
    return await dispatchStoreRequest(req, store, pathname, url);
  } catch (err) {
    return storeError(err);
  }
}

async function dispatchStoreRequest(
  req: Request,
  store: ObjectStore,
  pathname: string,
  url: URL
): Promise<Response> {
  if (
    pathname === PRODUCT_SIMULATOR_SNAPSHOT_OBJECTS_PATH &&
    url.searchParams.get('list') === '1'
  ) {
    if (req.method !== 'GET') {
      return json({ error: 'method not allowed' }, 405);
    }
    const prefix = url.searchParams.get('prefix') ?? '';
    const keys = await store.listKeys(prefix);
    return json({ keys });
  }

  const key = decodeObjectKey(pathname);
  if (key === null) {
    return json({ error: 'invalid object key' }, 400);
  }

  switch (req.method) {
    case 'GET': {
      const obj = await store.get(key);
      if (obj === null) return new Response(null, { status: 404 });
      const bytes = await readBytes(obj.body);
      const ab = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(ab).set(bytes);
      return new Response(ab, {
        status: 200,
        headers: {
          'content-type': obj.contentType,
          'content-length': String(bytes.byteLength),
          'cache-control': 'no-store',
        },
      });
    }
    case 'HEAD': {
      const exists = await store.head(key);
      return new Response(null, { status: exists ? 200 : 404 });
    }
    case 'PUT': {
      const contentType =
        req.headers.get('content-type') ?? 'application/octet-stream';
      const buf = new Uint8Array(await req.arrayBuffer());
      await store.put(key, buf, contentType);
      return new Response(null, { status: 204 });
    }
    case 'DELETE': {
      await store.delete(key);
      return new Response(null, { status: 204 });
    }
    default:
      return json({ error: 'method not allowed' }, 405);
  }
}
