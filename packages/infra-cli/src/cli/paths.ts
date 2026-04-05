import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const THIS_DIR = dirname(fileURLToPath(import.meta.url));

export const INFRA_CLI_ROOT = resolve(THIS_DIR, '..', '..');

export const TF_PACKAGE_ROOT = resolve(INFRA_CLI_ROOT, '..', 'terraform');

export const REPO_ROOT = resolve(INFRA_CLI_ROOT, '..', '..');
