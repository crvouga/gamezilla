// @io-wall-ok — build-tool cache adapter: one file per transformed module.
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { renameReplacing } from '@pkgs/fs-server-ts/rename-replacing';
import type { TransformStore } from './transform-cache.ts';

/** A `TransformStore` in `dir`, made when first written to. */
export function directoryTransformStore(dir: string): TransformStore {
  return {
    read: (key) => {
      try {
        return readFileSync(join(dir, key), 'utf8');
      } catch {
        return null;
      }
    },
    write: (key, value) => {
      mkdirSync(dir, { recursive: true });
      // Whole or absent: a build reading beside this never sees half a file.
      const partial = join(dir, `${key}.partial`);
      writeFileSync(partial, value, 'utf8');
      renameReplacing(partial, join(dir, key));
    },
    keys: () =>
      existsSync(dir)
        ? readdirSync(dir).filter((name) => !name.endsWith('.partial'))
        : [],
    remove: (key) => rmSync(join(dir, key), { force: true }),
  };
}
