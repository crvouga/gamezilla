// @io-wall-ok

import { renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeLoopbackOriginToLocalhost } from '@libs/auth/public/local-api-origin';
import { DEFAULT_LOCAL_PREVIEW_API_ORIGIN } from '@libs/client-config/public/local-preview-api-origin';
import { assertDevSecretsEnv } from '@libs/db/public/database-url-policy';
import { assertNonProdDatabaseUrlForTooling } from '@libs/db/public/database-url-policy-tooling';
import {
  getApiWorkerSecrets,
  loadSecretsIntoEnv,
} from '@libs/secrets/public/secrets';
import { wallTimers } from '@pkgs/clock';
import {
  EMQX_API_KEY,
  EMQX_API_SECRET,
  EMQX_DASHBOARD_PORT,
  EMQX_JWT_SECRET,
  EMQX_WS_PORT,
} from '@pkgs/emqx-server';
import { createRepoTreeObjectStore } from '@pkgs/object-store-node-fs/repo-tree-store';
import { LOCAL_DATABASE_URL } from '@pkgs/postgres-embedded';
import { resolveSecretsScope } from '@pkgs/secrets-config/index';
import { DEV_VARS_PATH, encodeDevVarValue } from './dev-vars';

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(apiRoot, '../..');
const configStore = createRepoTreeObjectStore({ rootDir: repoRoot });
const outPath = DEV_VARS_PATH;
const tmpPath = `${outPath}.${process.pid}.tmp`;

/** Loopback EMQX when CI boots `@pkgs/emqx-server` — Infisical EMQX_* ignored. */
const LOCAL_EMQX_DEV_SECRETS: Readonly<Record<string, string>> = {
  EMQX_API_URL: `http://127.0.0.1:${String(EMQX_DASHBOARD_PORT)}`,
  EMQX_API_KEY,
  EMQX_API_SECRET,
  EMQX_JWT_SECRET,
  EMQX_WSS_URL: `ws://127.0.0.1:${String(EMQX_WS_PORT)}/mqtt`,
};

const LOCAL_POSTGRES_DATABASE_URL = LOCAL_DATABASE_URL;

/**
 * Worker secrets that enable optional cloud features. Missing values are skipped
 * so local boot can degrade those features instead of failing setup.
 */
const OPTIONAL_FEATURE_WORKER_SECRETS: ReadonlySet<string> = new Set([
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'S3_BUCKET',
  'S3_ENDPOINT',
  'S3_REGION',
  'WEB_CLIENT_GOOGLE_CLIENT_ID',
  'WEB_CLIENT_GOOGLE_CLIENT_SECRET',
  'ELEVEN_LABS_API_KEY',
  'EMQX_API_URL',
  'EMQX_WSS_URL',
  'EMQX_API_KEY',
  'EMQX_API_SECRET',
  'EMQX_JWT_SECRET',
  'API_URL',
  'VITE_API_URL',
  'LOCAL_PREVIEW_API_ORIGIN',
  'VITE_COMMIT_HASH',
  'VITE_COMMIT_DATE',
]);

function readApiUrlForDevVars(): string {
  const localPreview = process.env['LOCAL_PREVIEW_API_ORIGIN']?.trim() ?? '';
  if (localPreview.length > 0) {
    return normalizeLoopbackOriginToLocalhost(localPreview);
  }
  const vite = process.env['VITE_API_URL']?.trim() ?? '';
  if (vite.length > 0 && /127\.0\.0\.1|localhost/i.test(vite)) {
    return normalizeLoopbackOriginToLocalhost(vite);
  }
  return DEFAULT_LOCAL_PREVIEW_API_ORIGIN;
}

function ensureAuthSecret(): string {
  const existing = process.env['AUTH_SECRET']?.trim() ?? '';
  if (existing.length >= 32) return existing;
  const bytes = new Uint8Array(32);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  const seeded = Buffer.from(bytes).toString('base64url');
  process.env['AUTH_SECRET'] = seeded;
  process.stdout.write(
    '[setup-dev-vars] AUTH_SECRET missing; seeded local random secret.\n'
  );
  return seeded;
}

function preferLocalSecretsOnly(): boolean {
  const raw = process.env['LOCAL_SECRETS']?.trim().toLowerCase() ?? '';
  return raw === '1' || raw === 'true';
}

const SECRETS_OVERLAY_TIMEOUT_MS = 8_000;

async function loadOptionalSecretsOverlay(): Promise<void> {
  if (preferLocalSecretsOnly()) {
    process.stdout.write(
      '[setup-dev-vars] LOCAL_SECRETS=1 — skipping Infisical loadSecretsIntoEnv.\n'
    );
    return;
  }
  try {
    await Promise.race([
      loadSecretsIntoEnv(),
      new Promise<never>((_, reject) => {
        wallTimers.setTimeout(() => {
          reject(
            new Error(`timed out after ${String(SECRETS_OVERLAY_TIMEOUT_MS)}ms`)
          );
        }, SECRETS_OVERLAY_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stdout.write(
      `[setup-dev-vars] secret overlay skipped (${message}); continuing with local defaults.\n`
    );
  }
}

async function main(): Promise<void> {
  const { env: secretsEnv } = await resolveSecretsScope(configStore);
  assertDevSecretsEnv(secretsEnv);
  // Best-effort Infisical overlay; local Postgres/EMQX always win below.
  await loadOptionalSecretsOverlay();

  await assertNonProdDatabaseUrlForTooling(LOCAL_POSTGRES_DATABASE_URL, {
    surface: 'setup-dev-vars',
    secretsEnv,
  });

  const lines: string[] = [`SECRETS_ENV=${encodeDevVarValue(secretsEnv)}`];
  lines.push(`API_URL=${encodeDevVarValue(readApiUrlForDevVars())}`);
  lines.push(`DATABASE_URL=${encodeDevVarValue(LOCAL_POSTGRES_DATABASE_URL)}`);
  const written = new Set<string>(['SECRETS_ENV', 'API_URL', 'DATABASE_URL']);

  process.stdout.write(
    '[setup-dev-vars] DATABASE_URL → loopback embedded Postgres (Infisical ignored).\n'
  );

  for (const [name, value] of Object.entries(LOCAL_EMQX_DEV_SECRETS)) {
    lines.push(`${name}=${encodeDevVarValue(value)}`);
    written.add(name);
  }
  process.stdout.write(
    '[setup-dev-vars] EMQX_* → loopback EMQX (Infisical ignored).\n'
  );

  const authSecret = ensureAuthSecret();
  lines.push(`AUTH_SECRET=${encodeDevVarValue(authSecret)}`);
  written.add('AUTH_SECRET');

  // Only Worker-bound secrets belong in `.dev.vars`. Infra-only keys
  // (CLOUDFLARE_*, TURBO_*, …) are skipped.
  for (const entry of getApiWorkerSecrets()) {
    if (written.has(entry.name)) continue;
    const value = (process.env[entry.name] ?? '').trim();
    if (value.length === 0) {
      if (entry.optional || OPTIONAL_FEATURE_WORKER_SECRETS.has(entry.name)) {
        process.stdout.write(
          `[setup-dev-vars] ${entry.name} unset; feature will degrade if needed.\n`
        );
        continue;
      }
      throw new Error(`setup-dev-vars: missing secret ${entry.name}`);
    }
    lines.push(`${entry.name}=${encodeDevVarValue(value)}`);
    written.add(entry.name);
  }

  const body = `${lines.join('\n')}\n`;
  writeFileSync(tmpPath, body, { encoding: 'utf8' });
  renameSync(tmpPath, outPath);

  process.stdout.write(
    `[setup-dev-vars] wrote .dev.vars with keys: ${lines
      .map((l) => l.split('=')[0])
      .join(', ')}\n`
  );
}

await main();
