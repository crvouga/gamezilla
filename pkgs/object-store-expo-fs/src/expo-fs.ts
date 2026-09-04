/**
 * Injectable Expo / OPFS surface used by object-store FS adapters.
 * Composition roots pass {@link ./wall-expo-fs.ts wallExpoFs()}.
 */

export type ExpoFsFile = {
  readonly exists: boolean;
  readonly uri: string;
  readonly name?: string;
  create(): void;
  delete(): void;
  write(bytes: Uint8Array | string): void;
  bytesSync(): Uint8Array;
  textSync(): string;
};

export type ExpoFsDirEntry = {
  readonly name: string;
  readonly kind: 'file' | 'directory';
};

export type ExpoFsDirectory = {
  readonly exists: boolean;
  create(options: { intermediates: boolean; idempotent: boolean }): void;
  /** Present on native expo-file-system Directory; may be missing in stubs. */
  list?: () => readonly ExpoFsDirEntry[];
};

export type ExpoFsPaths = {
  readonly document: unknown;
};

export type ExpoFsOpfsFileHandle = {
  createWritable(): Promise<{
    write(data: Uint8Array): Promise<void>;
    close(): Promise<void>;
  }>;
  getFile(): Promise<{
    arrayBuffer(): Promise<ArrayBuffer>;
    type: string;
    size: number;
  }>;
};

export type ExpoFsOpfsDirHandle = {
  getFileHandle(
    name: string,
    options?: { create?: boolean }
  ): Promise<ExpoFsOpfsFileHandle>;
  getDirectoryHandle(
    name: string,
    options?: { create?: boolean }
  ): Promise<ExpoFsOpfsDirHandle>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  keys(): AsyncIterableIterator<string>;
};

export type ExpoFs = {
  readonly paths: ExpoFsPaths;
  readonly platformOs: string;
  /**
   * Create a directory under `root` for the given path segments
   * (e.g. `['object-store', 'a', 'b']`).
   */
  createDirectory(root: unknown, ...segments: string[]): ExpoFsDirectory;
  createFile(dir: ExpoFsDirectory, name: string): ExpoFsFile;
  getOpfsRoot(): Promise<ExpoFsOpfsDirHandle>;
};
