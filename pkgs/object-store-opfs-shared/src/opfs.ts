/**
 * Structural subset of the browser File System Access API used by the OPFS
 * object store. Composition roots pass the real
 * `navigator.storage.getDirectory()` via {@link ./wall-browser-fs.ts};
 * tests pass {@link ./memory-opfs.ts createMemoryOpfsRoot()}.
 */

export type OpfsWritable = {
  write(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
};

export type OpfsFileHandle = {
  createWritable(): Promise<OpfsWritable>;
  getFile(): Promise<{
    arrayBuffer(): Promise<ArrayBuffer>;
    type: string;
    size: number;
  }>;
};

export type OpfsDirHandle = {
  getFileHandle(
    name: string,
    options?: { create?: boolean }
  ): Promise<OpfsFileHandle>;
  getDirectoryHandle(
    name: string,
    options?: { create?: boolean }
  ): Promise<OpfsDirHandle>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  keys(): AsyncIterableIterator<string>;
};

/** Lazily resolves the OPFS root directory (once per store). */
export type OpfsRootProvider = () => Promise<OpfsDirHandle>;

export function isNotFoundError(err: unknown): boolean {
  return err instanceof Error && err.name === 'NotFoundError';
}

export function notFoundError(name: string): Error {
  const err = new Error(`NotFoundError: ${name}`);
  err.name = 'NotFoundError';
  return err;
}
