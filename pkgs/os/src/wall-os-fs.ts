// @io-wall-ok
import { chmodSync, existsSync, mkdirSync } from 'node:fs';
import type { OsFs } from './os-fs';

export function wallOsFs(): OsFs {
  return {
    pathExists: existsSync,
    mkdirpSync: (absolutePath) => {
      mkdirSync(absolutePath, { recursive: true });
    },
    chmodSync,
  };
}
