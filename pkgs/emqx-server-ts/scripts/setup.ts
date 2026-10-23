// @io-wall-ok — composition-root wall FS via ObjectStore migration pending
/**
 * Seed the shared local EMQX data directory. `startEmqxServer` seeds whatever
 * directory it is pointed at, so this only prepares the default one.
 */
import { join } from 'node:path';
import { ensureEmqxDataDir } from '@pkgs/emqx-server-ts/start';

const APP_DIR = join(import.meta.dirname, '..');
const DATA_DIR = join(APP_DIR, 'data');

ensureEmqxDataDir(DATA_DIR);
console.warn('[emqx] setup complete', { data: DATA_DIR });
