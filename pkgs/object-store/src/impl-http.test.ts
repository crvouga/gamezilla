import { describe, expect, test } from 'bun:test';

import { readBytes } from './helpers';
import { createHttpObjectStore, type ObjectStoreHttpFetch } from './impl-http';
import { ObjectStoreImplInMemory } from './impl-in-memory';
import type { ObjectStore } from './interface';

const BASE = 'http://127.0.0.1:9/api/playground-snapshots/objects';

function bytesBody(bytes: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  return ab;
}

function createProxyFetch(backend: ObjectStore): ObjectStoreHttpFetch {
  return async (input, init) => {
    const req =
      input instanceof Request
        ? input
        : new Request(String(input), init ?? undefined);
    const url = new URL(req.url);
    const pathname = url.pathname;

    if (
      pathname === '/api/playground-snapshots/objects' &&
      url.searchParams.get('list') === '1'
    ) {
      const prefix = url.searchParams.get('prefix') ?? '';
      const keys = await backend.listKeys(prefix);
      return Response.json({ keys });
    }

    const prefix = '/api/playground-snapshots/objects/';
    if (!pathname.startsWith(prefix)) {
      return new Response('not found', { status: 404 });
    }
    const key = pathname
      .slice(prefix.length)
      .split('/')
      .map((s) => decodeURIComponent(s))
      .join('/');

    switch (req.method) {
      case 'GET': {
        const obj = await backend.get(key);
        if (obj === null) return new Response(null, { status: 404 });
        const bytes = await readBytes(obj.body);
        return new Response(bytesBody(bytes), {
          headers: { 'content-type': obj.contentType },
        });
      }
      case 'HEAD': {
        const exists = await backend.head(key);
        return new Response(null, { status: exists ? 200 : 404 });
      }
      case 'PUT': {
        const contentType =
          req.headers.get('content-type') ?? 'application/octet-stream';
        const buf = new Uint8Array(await req.arrayBuffer());
        await backend.put(key, buf, contentType);
        return new Response(null, { status: 204 });
      }
      case 'DELETE': {
        await backend.delete(key);
        return new Response(null, { status: 204 });
      }
      default:
        return new Response('method not allowed', { status: 405 });
    }
  };
}

describe('ObjectStoreImplHttp', () => {
  test('put / get / head / listKeys / delete round-trip', async () => {
    const backend = new ObjectStoreImplInMemory();
    const store = createHttpObjectStore({
      baseUrl: BASE,
      fetch: createProxyFetch(backend),
    });

    const bytes = new Uint8Array([1, 2, 3]);
    await store.put('snapshots/a/manifest.json', bytes, 'application/json');

    expect(await store.head('snapshots/a/manifest.json')).toBe(true);
    expect(await store.head('missing')).toBe(false);

    const got = await store.get('snapshots/a/manifest.json');
    expect(got).not.toBeNull();
    expect(got!.contentType).toBe('application/json');
    expect(await readBytes(got!.body)).toEqual(bytes);
    expect(await store.get('missing')).toBeNull();

    expect(await store.listKeys('snapshots/')).toEqual([
      'snapshots/a/manifest.json',
    ]);
    expect(await store.getUri('snapshots/a/manifest.json')).toBeNull();

    await store.delete('snapshots/a/manifest.json');
    expect(await store.head('snapshots/a/manifest.json')).toBe(false);
  });

  test('withPrefix scopes keys', async () => {
    const backend = new ObjectStoreImplInMemory();
    const root = createHttpObjectStore({
      baseUrl: BASE,
      fetch: createProxyFetch(backend),
    });
    const scoped = root.withPrefix('playground-snapshots/');
    await scoped.put(
      'index.json',
      new TextEncoder().encode('{}'),
      'application/json'
    );

    expect(await backend.listKeys()).toEqual([
      'playground-snapshots/index.json',
    ]);
    expect(await scoped.listKeys()).toEqual(['index.json']);
  });

  test('surfaces HTTP error bodies', async () => {
    const store = createHttpObjectStore({
      baseUrl: BASE,
      fetch: async () =>
        Response.json({ error: 'S3 credentials required' }, { status: 503 }),
    });
    await expect(store.listKeys()).rejects.toThrow(/S3 credentials required/);
  });
});
