// @io-wall-ok
/**
 * Sync path-existence probe for composition roots that still need a boolean
 * `exists` for monorepo-root walks. Prefer ObjectStore.head for content I/O.
 */
import { existsSync } from 'node:fs';

import type { PathExists } from './local-data-dir';

export const wallPathExists: PathExists = (absolutePath) =>
  existsSync(absolutePath);
