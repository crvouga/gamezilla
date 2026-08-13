/**
 * Injectable Node/Bun filesystem surface used by {@link ./impl-node-fs.ts}.
 * Composition roots pass {@link ./wall-node-fs.ts wallNodeFs()}; libraries never
 * import `node:fs` directly.
 */

export type NodeFsDirent = {
  readonly name: string;
  isDirectory(): boolean;
  isFile(): boolean;
};

export type NodeFsStats = {
  isDirectory(): boolean;
  isFile(): boolean;
  readonly size: number;
};

export type NodeFs = {
  mkdir(
    path: string,
    options?: { recursive?: boolean }
  ): Promise<string | undefined>;
  readFile(path: string): Promise<Uint8Array>;
  readFile(path: string, encoding: 'utf8'): Promise<string>;
  writeFile(path: string, contents: Uint8Array | string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  rm(
    path: string,
    options?: { force?: boolean; recursive?: boolean }
  ): Promise<void>;
  readdir(
    path: string,
    options: { withFileTypes: true }
  ): Promise<readonly NodeFsDirent[]>;
  stat(path: string): Promise<NodeFsStats>;
};
