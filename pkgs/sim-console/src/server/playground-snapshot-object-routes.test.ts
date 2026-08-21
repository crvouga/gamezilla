import { describe, expect, test } from 'bun:test';

import { readBytes } from '@pkgs/object-store/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';

import {
  handlePlaygroundSnapshotObjectRequest,
  PLAYGROUND_SNAPSHOT_OBJECTS_PATH,
} from './playground-snapshot-object-routes';

const BASE = `http://127.0.0.1:7789${PLAYGROUND_SNAPSHOT_OBJECTS_PATH}`;

describe('handlePlaygroundSnapshotObjectRequest', () => {
  test('returns null for unrelated paths', async () => {
    const res = await handlePlaygroundSnapshotObjectRequest(
      new Request('http://127.0.0.1:7789/api/other'),
      new ObjectStoreImplInMemory()
    );
    expect(res).toBeNull();
  });

  test('503 when store is null', async () => {
    const res = await handlePlaygroundSnapshotObjectRequest(
      new Request(`${BASE}?list=1`),
      null
    );
    expect(res).not.toBeNull();
    expect(res!.status).toBe(503);
    const body = (await res!.json()) as { error: string };
    expect(body.error).toMatch(/unavailable/i);
  });

  test('502 when store throws', async () => {
    const store = new ObjectStoreImplInMemory();
    const res = await handlePlaygroundSnapshotObjectRequest(
      new Request(`${BASE}/index.json`),
      {
        get: async () => {
          throw new Error('boom get');
        },
        put: store.put.bind(store),
        head: store.head.bind(store),
        delete: store.delete.bind(store),
        getUri: store.getUri.bind(store),
        listKeys: store.listKeys.bind(store),
        withPrefix: store.withPrefix.bind(store),
      }
    );
    expect(res).not.toBeNull();
    expect(res!.status).toBe(502);
    const body = (await res!.json()) as { error: string };
    expect(body.error).toBe('boom get');
  });

  test('put get list delete', async () => {
    const store = new ObjectStoreImplInMemory();
    const put = await handlePlaygroundSnapshotObjectRequest(
      new Request(`${BASE}/index.json`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: '{"ok":true}',
      }),
      store
    );
    expect(put!.status).toBe(204);

    const list = await handlePlaygroundSnapshotObjectRequest(
      new Request(`${BASE}?list=1`),
      store
    );
    expect(await list!.json()).toEqual({ keys: ['index.json'] });

    const get = await handlePlaygroundSnapshotObjectRequest(
      new Request(`${BASE}/index.json`),
      store
    );
    expect(get!.status).toBe(200);
    expect(await get!.text()).toBe('{"ok":true}');

    const del = await handlePlaygroundSnapshotObjectRequest(
      new Request(`${BASE}/index.json`, { method: 'DELETE' }),
      store
    );
    expect(del!.status).toBe(204);
    expect(await store.head('index.json')).toBe(false);
  });

  test('nested keys survive encode', async () => {
    const store = new ObjectStoreImplInMemory();
    const key = 'snapshots/snap-1/sql/server.bin';
    const bytes = new Uint8Array([9, 8, 7]);
    const encoded = key
      .split('/')
      .map((s) => encodeURIComponent(s))
      .join('/');
    await handlePlaygroundSnapshotObjectRequest(
      new Request(`${BASE}/${encoded}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/octet-stream' },
        body: bytes,
      }),
      store
    );
    const got = await store.get(key);
    expect(got).not.toBeNull();
    expect(await readBytes(got!.body)).toEqual(bytes);
  });
});
