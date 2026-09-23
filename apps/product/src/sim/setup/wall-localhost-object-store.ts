// @io-wall-ok — Node-only HTTP adapter for the local S3 sidecar.
import { ObjectStoreWithPrefix } from '@pkgs/object-store/impl-with-prefix';
import type { ObjectStore, StoredObject } from '@pkgs/object-store/interface';

function urlFor(origin: string, path: string, key: string): string {
  const url = new URL(path, origin);
  url.searchParams.set('key', key);
  return url.href;
}

async function expectOk(response: Response): Promise<Response> {
  if (!response.ok) {
    throw new Error(
      `localhost object store: ${response.status} ${await response.text()}`
    );
  }
  return response;
}

/** HTTP bridge to the Node-conditions S3 sidecar. */
export function createLocalhostObjectStore(origin: string): ObjectStore {
  const root: ObjectStore = {
    async get(key): Promise<StoredObject | null> {
      const response = await fetch(urlFor(origin, '/object', key));
      if (response.status === 404) return null;
      await expectOk(response);
      if (response.body === null)
        throw new Error('object response has no body');
      return {
        body: response.body,
        contentType:
          response.headers.get('content-type') ?? 'application/octet-stream',
        size: Number(response.headers.get('content-length') ?? '0'),
      };
    },
    async put(key, bytes, contentType): Promise<void> {
      await expectOk(
        await fetch(urlFor(origin, '/object', key), {
          method: 'PUT',
          headers: { 'content-type': contentType },
          body: new Uint8Array(bytes),
        })
      );
    },
    async head(key): Promise<boolean> {
      const response = await fetch(urlFor(origin, '/object', key), {
        method: 'HEAD',
      });
      if (response.status === 404) return false;
      await expectOk(response);
      return true;
    },
    async delete(key): Promise<void> {
      await expectOk(
        await fetch(urlFor(origin, '/object', key), { method: 'DELETE' })
      );
    },
    async getUri(key): Promise<string | null> {
      const response = await expectOk(await fetch(urlFor(origin, '/uri', key)));
      return ((await response.json()) as { uri: string | null }).uri;
    },
    async listKeys(prefix): Promise<readonly string[]> {
      const url = new URL('/keys', origin);
      if (prefix !== undefined) url.searchParams.set('prefix', prefix);
      const response = await expectOk(await fetch(url));
      return ((await response.json()) as { keys: string[] }).keys;
    },
    withPrefix(prefix): ObjectStore {
      return new ObjectStoreWithPrefix(root, prefix);
    },
  };
  return root;
}
