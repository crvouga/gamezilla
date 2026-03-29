import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** This file lives in `aws/deployment-pipeline-cli/`. */
const CLI_PACKAGE_DIR = dirname(fileURLToPath(import.meta.url));

/** Directory containing `cdk.json` (the `gamezilla-aws` package). */
export const AWS_PACKAGE_ROOT = join(CLI_PACKAGE_DIR, '..');

/** Monorepo root (parent of `aws/`). */
export const REPO_ROOT = join(CLI_PACKAGE_DIR, '..', '..');
