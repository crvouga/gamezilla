import {
  assertDevVaultConfig,
  assertNonProdDatabaseUrl,
} from '@libs/infra/shared/database-url-policy';
import { DEFAULT_LOCAL_PREVIEW_API_ORIGIN } from '@libs/client-config/shared/local-preview-api-origin';
import { createVaultSecretStoreForScripts } from '@pkgs/secret-store';
import { VaultCli } from '@pkgs/vault';
import { renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEV_VARS_PATH, encodeDevVarValue } from './dev-vars';

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = DEV_VARS_PATH;
const tmpPath = `${outPath}.${process.pid}.tmp`;

type VaultScope = {
  token: string;
  project: string;
  config: string;
  addr: string;
};

function resolveVaultScope(): VaultScope {
  const cli = new VaultCli({ cwd: join(apiRoot, '../..') });
  let token: string;
  try {
    const resolved = cli.resolveToken();
    if (resolved.source === 'file') {
      process.stdout.write(
        '[setup-dev-vars] VAULT_TOKEN not set in env; using ~/.vault-token.\n'
      );
    }
    token = resolved.token;
  } catch {
    process.stderr.write(
      '[setup-dev-vars] VAULT_TOKEN is required. Set it in env, or run `vault login` so ~/.vault-token is populated.\n'
    );
    process.exit(1);
  }

  const scope = cli.resolveScope();
  return {
    token,
    project: scope.project,
    config: scope.config,
    addr: scope.addr,
  };
}

function readApiUrlForDevVars(): string {
  const preview = process.env['BETTER_AUTH_PREVIEW_API_URL']?.trim() ?? '';
  if (preview.length > 0) return preview;
  const localPreview = process.env['LOCAL_PREVIEW_API_ORIGIN']?.trim() ?? '';
  if (localPreview.length > 0) return localPreview;
  const expo = process.env['EXPO_PUBLIC_API_URL']?.trim() ?? '';
  if (expo.length > 0 && /127\.0\.0\.1|localhost/i.test(expo)) {
    return expo;
  }
  return DEFAULT_LOCAL_PREVIEW_API_ORIGIN;
}

async function resolveDatabaseUrlForDevVars(
  vaultConfig: string
): Promise<string> {
  assertDevVaultConfig(vaultConfig);
  const store = createVaultSecretStoreForScripts();
  const databaseUrl = (
    await store.getRequired('DATABASE_URL')
  ).readSecretValue();
  await assertNonProdDatabaseUrl(databaseUrl, {
    surface: 'setup-dev-vars',
    vaultConfig,
  });
  return databaseUrl;
}

async function main(): Promise<void> {
  const { token, project, config, addr } = resolveVaultScope();
  assertDevVaultConfig(config);
  const databaseUrl = await resolveDatabaseUrlForDevVars(config);
  const lines: string[] = [
    `VAULT_TOKEN=${encodeDevVarValue(token)}`,
    `VAULT_PROJECT=${encodeDevVarValue(project)}`,
    `VAULT_CONFIG=${encodeDevVarValue(config)}`,
    `VAULT_ADDR=${encodeDevVarValue(addr)}`,
    `API_URL=${encodeDevVarValue(readApiUrlForDevVars())}`,
  ];
  lines.push(`DATABASE_URL=${encodeDevVarValue(databaseUrl)}`);

  const devIdpPort = process.env['DEV_IDP_PORT']?.trim() ?? '';
  if (devIdpPort.length > 0) {
    lines.push(`DEV_IDP_PORT=${encodeDevVarValue(devIdpPort)}`);
  }

  const body = `${lines.join('\n')}\n`;
  writeFileSync(tmpPath, body, { encoding: 'utf8' });
  renameSync(tmpPath, outPath);

  process.stdout.write(
    `[setup-dev-vars] wrote .dev.vars with keys: ${lines
      .map((l) => l.split('=')[0])
      .join(
        ', '
      )} (Worker secrets load from Vault; DATABASE_URL mirrors Vault \`dev\`)\n`
  );
}

await main();
