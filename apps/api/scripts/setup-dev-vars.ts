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

  const databaseUrl = (process.env['DATABASE_URL'] ?? '').trim();
  await assertNonProdDatabaseUrlForTooling(databaseUrl, {
    surface: 'setup-dev-vars',
    secretsEnv,
  });

  const lines: string[] = [`SECRETS_ENV=${encodeDevVarValue(secretsEnv)}`];
  lines.push(`API_URL=${encodeDevVarValue(readApiUrlForDevVars())}`);
  const written = new Set<string>(['SECRETS_ENV', 'API_URL']);

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
