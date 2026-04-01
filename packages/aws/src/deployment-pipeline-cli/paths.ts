import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** This file lives in `packages/aws/src/deployment-pipeline-cli/`. */
const CLI_PACKAGE_DIR = dirname(fileURLToPath(import.meta.url));

/** Directory containing `cdk.json` (the `packages/aws` package). */
export const AWS_PACKAGE_ROOT = join(CLI_PACKAGE_DIR, '..', '..');

/** Monorepo root (parent of `packages/`). */
export const REPO_ROOT = join(CLI_PACKAGE_DIR, '..', '..', '..', '..');
