import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const THIS_DIR = dirname(fileURLToPath(import.meta.url));

/** `libs/secrets-server-ts` — this file lives in its `src/`. */
export const SECRETS_PKG_ROOT = resolve(THIS_DIR, '..');

export const REPO_ROOT = resolve(SECRETS_PKG_ROOT, '..', '..');
