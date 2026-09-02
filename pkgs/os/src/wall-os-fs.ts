// @io-wall-ok
import { chmodSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import type { OsFs } from './os-fs';

export function wallOsFs(): OsFs {
  return {
    pathExists: existsSync,
    mkdirpSync: (absolutePath) => {
      mkdirSync(absolutePath, { recursive: true });
    },
    chmodSync,
    readdirSync: (absolutePath) => readdirSync(absolutePath),
    rmrfSync: (absolutePath) => {
      rmSync(absolutePath, { recursive: true, force: true });
    },
  };
}
