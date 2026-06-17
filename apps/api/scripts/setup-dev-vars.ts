import {
  buildConnectionUrl,
  loadPostgresConfig,
} from '@pkgs/postgres/postgres-config';
import { isLoopbackPostgresUrl } from '@pkgs/sql-client/postgres-connect';
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

function readApiUrlOverrideFromEnv(): string | null {
  const preview = process.env['BETTER_AUTH_PREVIEW_API_URL']?.trim() ?? '';
  if (preview.length > 0) return preview;
  const expo = process.env['EXPO_PUBLIC_API_URL']?.trim() ?? '';
  if (expo.length > 0 && /127\.0\.0\.1|localhost/i.test(expo)) {
    return expo;
  }
  const raw = process.env['API_URL']?.trim() ?? '';
  return raw.length > 0 ? raw : null;
}

function isPostgresWireUrl(url: string): boolean {
  return url.startsWith('postgresql://') || url.startsWith('postgres://');
}

function readDatabaseUrlOverrideFromEnv(): string | null {
  const raw = process.env['DATABASE_URL']?.trim() ?? '';
  if (raw.length === 0 || !isPostgresWireUrl(raw)) return null;
  // Playwright / turbo preview sets loopback before setup; honor that override.
  if (!isLoopbackPostgresUrl(raw)) return null;
  return raw;
}

/**
 * Local `bun dev` always boots `@pkgs/postgres`. Vault `dev` may still expose a
 * hosted `DATABASE_URL`, but the Worker and migrate script must hit the same
 * embedded cluster (see `libs/qa` preview wiring).
 */
function resolveDatabaseUrlForDevVars(): string {
  const fromEnv = readDatabaseUrlOverrideFromEnv();
  if (fromEnv !== null) return fromEnv;
  return buildConnectionUrl(loadPostgresConfig());
}

async function main(): Promise<void> {
  const { token, project, config, addr } = resolveVaultScope();
  const lines: string[] = [
    `VAULT_TOKEN=${encodeDevVarValue(token)}`,
    `VAULT_PROJECT=${encodeDevVarValue(project)}`,
    `VAULT_CONFIG=${encodeDevVarValue(config)}`,
    `VAULT_ADDR=${encodeDevVarValue(addr)}`,
  ];
  const apiUrlOverride = readApiUrlOverrideFromEnv();
  if (apiUrlOverride !== null) {
    lines.push(`API_URL=${encodeDevVarValue(apiUrlOverride)}`);
  }
  lines.push(
    `DATABASE_URL=${encodeDevVarValue(resolveDatabaseUrlForDevVars())}`
  );

  const body = `${lines.join('\n')}\n`;
  writeFileSync(tmpPath, body, { encoding: 'utf8' });
  renameSync(tmpPath, outPath);

  process.stdout.write(
    `[setup-dev-vars] wrote .dev.vars with keys: ${lines
      .map((l) => l.split('=')[0])
      .join(
        ', '
      )} (Worker secrets load from Vault; DATABASE_URL pins the embedded Postgres cluster)\n`
  );
}

await main();
