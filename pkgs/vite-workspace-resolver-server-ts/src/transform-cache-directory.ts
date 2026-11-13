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
      writeFileSync(join(dir, key), value, 'utf8');
    },
    keys: () => (existsSync(dir) ? readdirSync(dir) : []),
    remove: (key) => rmSync(join(dir, key), { force: true }),
  };
}
