import { readObjectBytes } from '@pkgs/object-store-shared/helpers';
import type { ObjectStore } from '@pkgs/object-store-shared/interface';
import { createStaticFileHandler } from './static-file-server';

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(out).set(bytes);
  return out;
}

function createBunFileAdapter(store: ObjectStore) {
  return async (pathname: string): Promise<Blob | null> => {
    const safePath =
      pathname === '/' ? 'index.html' : (pathname.slice(1).split('?')[0] ?? '');
    if (safePath.length === 0 || safePath.includes('..')) {
      return null;
    }
    const bytes = await readObjectBytes(store, safePath);
    if (bytes === null) return null;
    return new Blob([toArrayBuffer(bytes)]);
  };
}

export function createStaticFileHandlerBun(store: ObjectStore) {
  return createStaticFileHandler({
    getFile: createBunFileAdapter(store),
  });
}
