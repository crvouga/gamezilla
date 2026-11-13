#!/usr/bin/env bun
// @io-wall-ok — the Preview workflow's entry: the secrets backend, the identity file and the clock.
/**
 * The Preview workflow's one command (`ci.ts run`, and `ci.ts failed` after a
 * run that failed). The job hands it a checkout, the tools and the
 * dependencies and nothing else, so it first makes the rest of what a deploy
 * needs, itself and in a second:
 *
 * - **The secrets**, read from the `dev` secrets environment with the run's
 *   own OIDC token: the three a deploy uses, not the environment. A token
 *   that can read more never outlives this step, and the Cloudflare
 *   credential never reaches a build.
 * - **The identity**, materialized from public configuration before any
 *   module reads it, which is why the commands are imported only afterwards.
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { configuredIdentity } from '@libs/product-brand-shared-ts/identity-input';
import { wallClock } from '@pkgs/clock-shared-ts/wall';
import { createRepoTreeObjectStore } from '@pkgs/object-store-node-fs-server-ts/repo-tree-store';
import { createConfiguredSecretStore } from '@pkgs/secret-provider-server-ts/create-configured-secret-store';
import {
  MINTED_TOKEN_EXPIRES_AT,
  resolveInfisicalAccessTokenForWrites,
} from '@pkgs/secret-provider-server-ts/oidc-access-token';

const REPO_ROOT = join(import.meta.dirname, '../../..');
/** Never production: a pull request's code builds in this job. */
const SECRETS_ENV = 'dev';
/** Cloudflare to deploy, and the Turborepo cache to build from. */
const SECRETS = [
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_API_TOKEN',
  'TURBO_TOKEN',
] as const;
/** Public, and stored beside the secrets when it is not a repository variable. */
const IDENTITY = 'PRODUCT_IDENTITY_JSON';

/** Keeps a value out of the job log, as the secrets action would. */
function mask(value: string): void {
  for (const line of value.split('\n'))
    if (line.trim() !== '') process.stdout.write(`::add-mask::${line}\n`);
}

async function injectSecrets(): Promise<void> {
  const configStore = createRepoTreeObjectStore({ rootDir: REPO_ROOT });
  const token = await resolveInfisicalAccessTokenForWrites({
    repoRoot: REPO_ROOT,
    configStore,
    secretsEnv: SECRETS_ENV,
    clock: wallClock,
  });
  if (token === null)
    throw new Error(
      'no OIDC token for the secrets backend (a job without `id-token: write`, or SECRETS_IDENTITY_ID unset)'
    );
  mask(token);
  const store = await createConfiguredSecretStore({
    repoRoot: REPO_ROOT,
    configStore,
    envOverride: SECRETS_ENV,
    token,
    fetchFn: fetch,
    clock: wallClock,
  });
  const values = await store.getOptionalMany([...SECRETS, IDENTITY]);
  // The token reads the whole environment; nothing after this needs it.
  for (const name of [
    'INFISICAL_TOKEN',
    'SECRETS_TOKEN',
    MINTED_TOKEN_EXPIRES_AT,
  ])
    delete process.env[name];
  for (const name of SECRETS) {
    const value = values[name]?.readSecretValue();
    if (value === undefined)
      throw new Error(`${name} is not in the ${SECRETS_ENV} secrets`);
    mask(value);
    process.env[name] = value;
  }
  // An identity stored with the secrets wins over the repository's variable.
  const identity = values[IDENTITY]?.readSecretValue();
  if (identity !== undefined) process.env[IDENTITY] = identity;
}

function materializeIdentity(): void {
  const identity = configuredIdentity(
    process.env[IDENTITY],
    () => process.env['REPOSITORY_IDENTITY_JSON']
  );
  process.env[IDENTITY] = JSON.stringify(identity);
  process.env['PRODUCT_IDENTITY_MODE'] = 'configured';
  const written = spawnSync(
    process.execPath,
    ['run', 'libs/tools-harness-ts/scripts/materialize-product-identity.ts'],
    { cwd: REPO_ROOT, env: process.env, stdio: 'inherit' }
  );
  if (written.status !== 0)
    throw new Error('the identity could not be materialized');
}

try {
  const step = process.argv[2];
  // Reporting a failed run reads the pull request, and no secret.
  if (step === 'run') await injectSecrets();
  materializeIdentity();
  const { main } = await import('./preview');
  await main(['ci', step ?? '']);
} catch (error) {
  process.stderr.write(
    `preview: ${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exit(1);
}
