import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI_PACKAGE_DIR = dirname(fileURLToPath(import.meta.url));

/** Directory containing Terraform HCL files (the `packages/terraform` package). */
export const TF_PACKAGE_ROOT = join(CLI_PACKAGE_DIR, '..', '..');

/** Monorepo root (parent of `packages/`). */
export const REPO_ROOT = join(CLI_PACKAGE_DIR, '..', '..', '..', '..');
