import { renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeLoopbackOriginToLocalhost } from '@libs/auth/shared/local-api-origin';
import { DEFAULT_LOCAL_PREVIEW_API_ORIGIN } from '@libs/client-config/shared/local-preview-api-origin';
import {
  getSecretMap,
  loadSecretsIntoEnv,
} from '@libs/infra/cli/secrets/secrets';
import { assertDevSecretsEnv } from '@libs/infra/shared/database-url-policy';
import { assertNonProdDatabaseUrlForTooling } from '@libs/infra/shared/database-url-policy-tooling';
import { resolveSecretsScope } from '@pkgs/secrets-config/index';
import { DEV_VARS_PATH, encodeDevVarValue } from './dev-vars';

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(apiRoot, '../..');
const outPath = DEV_VARS_PATH;
const tmpPath = `${outPath}.${process.pid}.tmp`;

/** Local @apps/emqx defaults when the secret store has not seeded EMQX_* yet. */
const LOCAL_EMQX_DEV_DEFAULTS: Readonly<Record<string, string>> = {
  EMQX_API_URL: 'http://127.0.0.1:18083',
  EMQX_API_KEY: 'pubsub-test',
  EMQX_API_SECRET: 'pubsub-test-secret',
  EMQX_JWT_SECRET: 'local-emqx-jwt-secret-change-me',
};

/**
 * Local `@apps/postgres` wire URL (keep in sync with apps/postgres/scripts/ports.ts).
 * SECRETS_ENV=dev always uses embedded Postgres — Infisical DATABASE_URL is ignored.
 */
const LOCAL_POSTGRES_DATABASE_URL =
  'postgresql://postgres:postgres@127.0.0.1:15432/gamezilla?sslmode=disable';

/**
 * Local `@apps/minio` S3 secrets (keep in sync with apps/minio/scripts/ports.ts).
 * SECRETS_ENV=dev always uses MinIO — Infisical B2/S3 app secrets are ignored.
 */
const LOCAL_MINIO_S3_SECRETS: Readonly<Record<string, string>> = {
  B2_APP_KEY_ID: 'minioadmin',
  B2_APP_KEY: 'minioadmin',
  S3_BUCKET: 'gamezilla',
  S3_ENDPOINT: 'http://127.0.0.1:9000',
  S3_REGION: 'us-east-1',
};

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

async function main(): Promise<void> {
  const { env: secretsEnv } = resolveSecretsScope(repoRoot);
  assertDevSecretsEnv(secretsEnv);
  await loadSecretsIntoEnv();

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

  for (const entry of getSecretMap()) {
    if (written.has(entry.name)) continue;
    const value = (process.env[entry.name] ?? '').trim();
    if (value.length === 0) {
      if (entry.optional) continue;
      throw new Error(`setup-dev-vars: missing secret ${entry.name}`);
    }
    lines.push(`${entry.name}=${encodeDevVarValue(value)}`);
    written.add(entry.name);
  }

  for (const [name, value] of Object.entries(LOCAL_EMQX_DEV_DEFAULTS)) {
    if (written.has(name)) continue;
    lines.push(`${name}=${encodeDevVarValue(value)}`);
    written.add(name);
    process.stdout.write(
      `[setup-dev-vars] ${name} unset in secrets; using local default.\n`
    );
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
