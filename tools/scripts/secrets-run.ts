/**
 * Run a command with secrets injected from the configured secret backend.
 *
 * Defaults come from repo-root `.secrets.json` (`SECRETS_ENV` defaults to `dev`).
 * Override with `SECRETS_PROJECT_ID` / `SECRETS_ENV` / `SECRETS_ADDR`.
 *
 * Local: delegates to the configured secrets CLI (user login).
 * CI: the secrets-auth action injects env vars before invoking this script.
 */

import { join } from 'node:path';
import { createRepoTreeObjectStore } from '@pkgs/object-store-node-fs/repo-tree-store';
import { runWithSecrets } from '@pkgs/secret-provider';

const REPO_ROOT = join(import.meta.dirname, '../..');
const childArgs = process.argv.slice(2);

process.exit(
  await runWithSecrets({
    repoRoot: REPO_ROOT,
    configStore: createRepoTreeObjectStore({ rootDir: REPO_ROOT }),
    childArgs,
  })
);
