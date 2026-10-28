// @io-wall-ok
import { chmodSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import type { OsFs } from '@pkgs/os-shared-ts/os-fs';
import { removeTree } from './remove-tree';

export function wallOsFs(): OsFs {
  return {
    pathExists: existsSync,
    mkdirpSync: (absolutePath) => {
      mkdirSync(absolutePath, { recursive: true });
    },
    chmodSync,
    readdirSync: (absolutePath) => readdirSync(absolutePath),
    rmrfSync: (absolutePath) => {
      removeTree(absolutePath);
    },
  };
}
