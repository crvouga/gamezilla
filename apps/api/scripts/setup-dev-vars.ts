// @io-wall-ok
import { renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeLoopbackOriginToLocalhost } from '@libs/auth/public/local-api-origin';
import { DEFAULT_LOCAL_PREVIEW_API_ORIGIN } from '@libs/client-config/public/local-preview-api-origin';
import {
  getApiWorkerSecrets,
  loadSecretsIntoEnv,
} from '@libs/infra/cli/secrets/secrets';
import { assertDevSecretsEnv } from '@libs/infra/shared/database-url-policy';
import { assertNonProdDatabaseUrlForTooling } from '@libs/infra/shared/database-url-policy-tooling';
import { wallIo } from '@pkgs/io';
import { createRepoTreeObjectStore } from '@pkgs/object-store/repo-tree-store';
import { resolveSecretsScope } from '@pkgs/secrets-config/index';
import { DEV_VARS_PATH, encodeDevVarValue } from './dev-vars';

const io = wallIo();

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(apiRoot, '../..');
const configStore = createRepoTreeObjectStore({ rootDir: repoRoot });
const outPath = DEV_VARS_PATH;
const tmpPath = `${outPath}.${process.pid}.tmp`;

/**
 * Local `@apps/emqx` secrets (keep in sync with apps/emqx/scripts/ports.ts).
 * SECRETS_ENV=dev always uses local EMQX — Infisical EMQX_* is ignored.
 */
const LOCAL_EMQX_DEV_SECRETS: Readonly<Record<string, string>> = {
  EMQX_API_URL: 'http://127.0.0.1:18083',
  EMQX_API_KEY: 'pubsub-test',
  EMQX_API_SECRET: 'pubsub-test-secret',
  EMQX_JWT_SECRET: 'local-emqx-jwt-secret-change-me',
  EMQX_WSS_URL: 'ws://127.0.0.1:8083/mqtt',
};

/**
 * Local `@apps/postgres` wire URL (keep in sync with apps/postgres/scripts/ports.ts).
 * SECRETS_ENV=dev always uses embedded Postgres — Infisical DATABASE_URL is ignored.
 */
const LOCAL_POSTGRES_DATABASE_URL =
  'postgresql://postgres:postgres@127.0.0.1:15432/local?sslmode=disable';

/**
 * Local `@apps/minio` S3 secrets (keep in sync with apps/minio/scripts/ports.ts).
 * SECRETS_ENV=dev always uses MinIO — Infisical B2/S3 app secrets are ignored.
 */
const LOCAL_MINIO_S3_SECRETS: Readonly<Record<string, string>> = {
  B2_APP_KEY_ID: 'minioadmin',
  B2_APP_KEY: 'minioadmin',
  S3_BUCKET: 'local',
  S3_ENDPOINT: 'http://127.0.0.1:9000',
  S3_REGION: 'us-east-1',
};

/**
 * Worker secrets that enable optional cloud features. Missing values are skipped
 * so local boot can degrade those features instead of failing setup.
 */
const OPTIONAL_FEATURE_WORKER_SECRETS: ReadonlySet<string> = new Set([
  'WEB_CLIENT_GOOGLE_CLIENT_ID',
  'WEB_CLIENT_GOOGLE_CLIENT_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_PUBLISHABLE_KEY',
  'ELEVEN_LABS_API_KEY',
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'EMQX_API_URL',
  'EMQX_WSS_URL',
  'EMQX_API_KEY',
  'EMQX_API_SECRET',
  'EMQX_JWT_SECRET',
  'OBSERVABILITY_BACKEND',
  'EXPO_PUBLIC_OBSERVABILITY_BACKEND',
  'API_URL',
  'EXPO_PUBLIC_API_URL',
  'LOCAL_PREVIEW_API_ORIGIN',
  'EXPO_PUBLIC_COMMIT_HASH',
  'EXPO_PUBLIC_COMMIT_DATE',
]);

function readApiUrlForDevVars(): string {
  const localPreview = process.env['LOCAL_PREVIEW_API_ORIGIN']?.trim() ?? '';
  if (localPreview.length > 0) {
    return normalizeLoopbackOriginToLocalhost(localPreview);
  }
  const expo = process.env['EXPO_PUBLIC_API_URL']?.trim() ?? '';
  if (expo.length > 0 && /127\.0\.0\.1|localhost/i.test(expo)) {
    return normalizeLoopbackOriginToLocalhost(expo);
  }
  return DEFAULT_LOCAL_PREVIEW_API_ORIGIN;
}

function ensureBetterAuthSecret(): string {
  const existing = process.env['BETTER_AUTH_SECRET']?.trim() ?? '';
  if (existing.length >= 32) return existing;
  const bytes = new Uint8Array(32);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Math.floor(io.random() * 256);
  }
  const seeded = Buffer.from(bytes).toString('base64url');
  process.env['BETTER_AUTH_SECRET'] = seeded;
  process.stdout.write(
    '[setup-dev-vars] BETTER_AUTH_SECRET missing; seeded local random secret.\n'
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
        io.timers.setTimeout(() => {
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
  // Best-effort Infisical overlay; local Postgres/MinIO/EMQX always win below.
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
    '[setup-dev-vars] DATABASE_URL → @apps/postgres local embedded (Infisical ignored).\n'
  );

  for (const [name, value] of Object.entries(LOCAL_MINIO_S3_SECRETS)) {
    lines.push(`${name}=${encodeDevVarValue(value)}`);
    written.add(name);
  }
  process.stdout.write(
    '[setup-dev-vars] S3/B2_APP_* → @apps/minio local (Infisical ignored).\n'
  );

  for (const [name, value] of Object.entries(LOCAL_EMQX_DEV_SECRETS)) {
    lines.push(`${name}=${encodeDevVarValue(value)}`);
    written.add(name);
  }
  process.stdout.write(
    '[setup-dev-vars] EMQX_* → @apps/emqx local (Infisical ignored).\n'
  );

  const betterAuthSecret = ensureBetterAuthSecret();
  lines.push(`BETTER_AUTH_SECRET=${encodeDevVarValue(betterAuthSecret)}`);
  written.add('BETTER_AUTH_SECRET');

  // Only Worker-bound secrets belong in `.dev.vars`. Infra-only keys
  // (CLOUDFLARE_*, EXPO_TOKEN, TURBO_*, B2_MASTER_*, …) are skipped.
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
