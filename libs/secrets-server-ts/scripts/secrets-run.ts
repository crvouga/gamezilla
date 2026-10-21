/**
 * Run a command with secrets injected from the configured secret backend.
 *
 * Defaults come from repo-root `.secrets.json` (`SECRETS_ENV` defaults to `dev`).
 * Override with `SECRETS_PROJECT_ID` / `SECRETS_ENV` / `SECRETS_ADDR`.
 *
 * Local offline-first: prefers `.cache/secrets/` from `bun run secrets:pull`.
 * CI: the secrets-auth action injects env vars before invoking this script.
 */

// @io-wall-ok — libs/secrets script composition root
import { join } from 'node:path';
import { REPO_SECRETS_ENVS } from '@libs/secrets-shared-ts/secrets-envs';
import { wallClock } from '@pkgs/clock-shared-ts/wall';
import { createRepoTreeObjectStore } from '@pkgs/object-store-node-fs-server-ts/repo-tree-store';
import { runWithSecrets } from '@pkgs/secret-provider-server-ts/run-with-secrets';

const REPO_ROOT = join(import.meta.dirname, '../../..');
const childArgs = process.argv.slice(2);
const clock = wallClock;
const nowMs = clock.now();

process.exit(
  await runWithSecrets({
    repoRoot: REPO_ROOT,
    configStore: createRepoTreeObjectStore({ rootDir: REPO_ROOT }),
    childArgs,
    envs: REPO_SECRETS_ENVS,
    nowMs,
    nowIso: new Date(nowMs).toISOString(),
  })
);
