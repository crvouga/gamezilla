// @io-wall-ok — composition-root wall FS via ObjectStore migration pending
/**
 * Idempotent bootstrap for `@apps/minio`: ensure data + cache dirs exist.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const APP_DIR = join(import.meta.dirname, '..');
const DATA_DIR = join(APP_DIR, 'data');
const CACHE_DIR = join(APP_DIR, '.cache');

mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(CACHE_DIR, { recursive: true });
process.stdout.write(`[minio] setup complete ${DATA_DIR}\n`);
