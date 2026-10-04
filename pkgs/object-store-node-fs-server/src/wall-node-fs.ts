// @io-wall-ok
/**
 * Wall Node/Bun filesystem adapter — the only product module allowed to import
 * `node:fs/promises`. Pass into {@link ./impl-node-fs.ts createNodeFsObjectStore}.
 */
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';

import type {
  NodeFs,
  NodeFsDirent,
  NodeFsStats,
} from '@pkgs/object-store-node-fs-shared/node-fs';

export function wallNodeFs(): NodeFs {
  return {
    mkdir: (path, options) => mkdir(path, options),
    readFile: ((path: string, encoding?: 'utf8') =>
      encoding === 'utf8'
        ? readFile(path, 'utf8')
        : readFile(path).then((b) => new Uint8Array(b))) as NodeFs['readFile'],
    writeFile: (path, contents) => writeFile(path, contents),
    rename: (from, to) => rename(from, to),
    rm: (path, options) => rm(path, options),
    readdir: async (path, options) => {
      const entries = await readdir(path, options);
      return entries as unknown as readonly NodeFsDirent[];
    },
    stat: async (path) => {
      const s = await stat(path);
      return {
        isDirectory: () => s.isDirectory(),
        isFile: () => s.isFile(),
        size: s.size,
      } satisfies NodeFsStats;
    },
  };
}
