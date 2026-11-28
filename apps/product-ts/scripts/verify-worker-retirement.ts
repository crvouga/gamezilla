// @io-wall-ok — release artifact check.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = (path: string) =>
  readFileSync(join(import.meta.dir, '..', path), 'utf8');
if (source('dist/sw.js') !== source('public/sw.js')) {
  throw new Error('The release must retire the previous application worker.');
}
