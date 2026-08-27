import { join } from 'node:path';

/** Monorepo root (tools/scripts/cli-deps → ../../..). */
export const REPO_ROOT = join(import.meta.dirname, '../../..');
