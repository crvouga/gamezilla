import { assertDevSecretsEnv } from '@libs/infra/shared/database-url-policy';
import { assertNonProdDatabaseUrlForTooling } from '@libs/infra/shared/database-url-policy-tooling';
import { DEFAULT_LOCAL_PREVIEW_API_ORIGIN } from '@libs/client-config/shared/local-preview-api-origin';
import { normalizeLoopbackOriginToLocalhost } from '@libs/auth/shared/local-api-origin';
import {
  getSecretMap,
  loadSecretsIntoEnv,
  loadWorkerApiSecretsIntoEnv,
} from '@libs/infra/cli/secrets/secrets';
import { API_WORKER_EXTERNALLY_MANAGED_SECRET_KEYS } from '@libs/infra/cli/secrets/worker-api-secrets';
import { resolveSecretsScope } from '@pkgs/secrets-config/index';
import { renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEV_VARS_PATH, encodeDevVarValue } from './dev-vars';

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(apiRoot, '../..');
const outPath = DEV_VARS_PATH;
const tmpPath = `${outPath}.${process.pid}.tmp`;

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
  loadSecretsIntoEnv();
  loadWorkerApiSecretsIntoEnv();

  const databaseUrl = (process.env['DATABASE_URL'] ?? '').trim();
  await assertNonProdDatabaseUrlForTooling(databaseUrl, {
    surface: 'setup-dev-vars',
    secretsEnv,
  });

  const lines: string[] = [`SECRETS_ENV=${encodeDevVarValue(secretsEnv)}`];
  lines.push(`API_URL=${encodeDevVarValue(readApiUrlForDevVars())}`);

  for (const entry of getSecretMap()) {
    const value = (process.env[entry.env] ?? '').trim();
    if (value.length === 0) {
      if (entry.optional === true) continue;
      throw new Error(`setup-dev-vars: missing secret ${entry.secretKey}`);
    }
    lines.push(`${entry.env}=${encodeDevVarValue(value)}`);
  }

  for (const key of API_WORKER_EXTERNALLY_MANAGED_SECRET_KEYS) {
    const value = (process.env[key] ?? '').trim();
    if (value.length === 0) {
      throw new Error(`setup-dev-vars: missing secret ${key}`);
    }
    lines.push(`${key}=${encodeDevVarValue(value)}`);
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
