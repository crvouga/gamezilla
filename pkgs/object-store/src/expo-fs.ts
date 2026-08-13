/**
 * Injectable Expo / OPFS surface used by {@link ./impl-expo-file-system.ts}.
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

export type ExpoFsDirectory = {
  readonly exists: boolean;
  create(options: { intermediates: boolean; idempotent: boolean }): void;
  /** Present on native expo-file-system Directory; may be missing in stubs. */
  list?: () => readonly { readonly name?: string; readonly exists?: boolean }[];
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
  createDirectory(root: unknown, baseDir: string): ExpoFsDirectory;
  createFile(dir: ExpoFsDirectory, name: string): ExpoFsFile;
  getOpfsRoot(): Promise<ExpoFsOpfsDirHandle>;
};
