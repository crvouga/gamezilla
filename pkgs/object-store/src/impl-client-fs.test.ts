import { describe, expect, test } from 'bun:test';

import type {
  ExpoFs,
  ExpoFsDirectory,
  ExpoFsFile,
  ExpoFsOpfsDirHandle,
  ExpoFsOpfsFileHandle,
} from './expo-fs';
import { readBytes } from './helpers';
import { createClientFsObjectStore } from './impl-client-fs';
import { createStaticObjectStore } from './impl-static';
import { runObjectStoreContractTests } from './object-store-contract';

/** In-memory OPFS tree for ClientFs contract tests (web path). */
function createMemoryExpoFs(): ExpoFs {
  type Node =
    | { kind: 'dir'; children: Map<string, Node> }
    | { kind: 'file'; bytes: Uint8Array };

  const root: Extract<Node, { kind: 'dir' }> = {
    kind: 'dir',
    children: new Map(),
  };

  function makeFileHandle(    parent: Extract<Node, { kind: 'dir' }>,
    name: string
  ): ExpoFsOpfsFileHandle {
    return {
      async createWritable() {
        let buf = new Uint8Array(0);
        return {
          async write(data: Uint8Array) {
            buf = new Uint8Array(data);
          },
          async close() {
            parent.children.set(name, { kind: 'file', bytes: buf });
          },
        };
      },
      async getFile() {
        const node = parent.children.get(name);
        if (node === undefined || node.kind !== 'file') {
          const err = new Error('NotFoundError');
          err.name = 'NotFoundError';
          throw err;
        }
        const ab = new ArrayBuffer(node.bytes.byteLength);
        new Uint8Array(ab).set(node.bytes);
        return {
          arrayBuffer: async () => ab,
          type: 'application/octet-stream',
          size: node.bytes.byteLength,
        };
      },
    };
  }

  function makeDirHandle(
    node: Extract<Node, { kind: 'dir' }>
  ): ExpoFsOpfsDirHandle {
    return {
      async getFileHandle(name, options) {
        const existing = node.children.get(name);
        if (existing !== undefined && existing.kind === 'file') {
          return makeFileHandle(node, name);
        }
        if (options?.create) {
          node.children.set(name, { kind: 'file', bytes: new Uint8Array() });
          return makeFileHandle(node, name);
        }
        const err = new Error('NotFoundError');
        err.name = 'NotFoundError';
        throw err;
      },
      async getDirectoryHandle(name, options) {
        const existing = node.children.get(name);
        if (existing !== undefined && existing.kind === 'dir') {
          return makeDirHandle(existing);
        }
        if (options?.create) {
          const child: Extract<Node, { kind: 'dir' }> = {
            kind: 'dir',
            children: new Map(),
          };
          node.children.set(name, child);
          return makeDirHandle(child);
        }
        const err = new Error('NotFoundError');
        err.name = 'NotFoundError';
        throw err;
      },
      async removeEntry(name) {
        if (!node.children.has(name)) {
          const err = new Error('NotFoundError');
          err.name = 'NotFoundError';
          throw err;
        }
        node.children.delete(name);
      },
      async *keys() {
        for (const name of node.children.keys()) yield name;
      },
    };
  }

  // Unused native path for web contract tests.
  const unusedNative: ExpoFsDirectory = {
    exists: false,
    create() {},
  };
  const unusedFile: ExpoFsFile = {
    exists: false,
    uri: '',
    create() {},
    delete() {},
    write() {},
    bytesSync: () => new Uint8Array(),
    textSync: () => '',
  };

  return {
    paths: { document: {} },
    platformOs: 'web',
    createDirectory() {
      return unusedNative;
    },
    createFile() {
      return unusedFile;
    },
    async getOpfsRoot() {
      return makeDirHandle(root);
    },
  };
}

describe('ObjectStore — ObjectStoreImplClientFs (port suite)', () => {
  runObjectStoreContractTests(() =>
    createClientFsObjectStore({
      baseDir: 'client-fs-test',
      expoFs: createMemoryExpoFs(),
    })
  );
});

describe('ObjectStoreImplStatic', () => {
  test('get / head / getUri / listKeys over fetch map', async () => {
    const files = new Map<string, { bytes: Uint8Array; contentType: string }>();
    files.set('keys.json', {
      bytes: new TextEncoder().encode(
        JSON.stringify(['a/x.json', 'b.txt', 'keys.json'])
      ),
      contentType: 'application/json',
    });
    files.set('a/x.json', {
      bytes: new TextEncoder().encode('{"ok":true}'),
      contentType: 'application/json',
    });
    files.set('b.txt', {
      bytes: new TextEncoder().encode('hi'),
      contentType: 'text/plain',
    });

    const store = createStaticObjectStore({
      baseUrl: '/reports',
      fetch: async (input) => {
        const url = String(input);
        const key = decodeURIComponent(url.replace(/^\/reports\//, ''));
        const hit = files.get(key);
        if (hit === undefined) return new Response(null, { status: 404 });
        const ab = new ArrayBuffer(hit.bytes.byteLength);
        new Uint8Array(ab).set(hit.bytes);
        return new Response(ab, {
          status: 200,
          headers: { 'content-type': hit.contentType },
        });
      },
    });

    expect(await store.head('missing')).toBe(false);
    expect(await store.get('missing')).toBeNull();
    const obj = await store.get('a/x.json');
    expect(obj).not.toBeNull();
    if (obj === null) return;
    expect(obj.contentType).toBe('application/json');
    expect(new TextDecoder().decode(await readBytes(obj.body))).toBe(
      '{"ok":true}'
    );
    expect(await store.getUri('b.txt')).toBe('/reports/b.txt');
    expect([...(await store.listKeys('a/'))]).toEqual(['a/x.json']);
    await expect(
      store.put('x', new Uint8Array([1]), 'text/plain')
    ).rejects.toThrow('read-only');
  });

  test('listKeys returns [] when keys.json missing', async () => {
    const store = createStaticObjectStore({
      baseUrl: 'http://x/reports',
      fetch: async () => new Response(null, { status: 404 }),
    });
    expect([...(await store.listKeys())]).toEqual([]);
  });
});
