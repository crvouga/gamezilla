import { VaultCli } from '@pkgs/vault';
import { isLoopbackPostgresUrl } from '@pkgs/sql-client/postgres-connect';
import { renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(apiRoot, '.dev.vars');
const tmpPath = `${outPath}.${process.pid}.tmp`;

function encodeDevVarValue(value: string): string {
  return `"${value
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('\n', '\\n')}"`;
}

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
  // `vault run` / `bun qa` inject hosted Neon into env before Playwright sets the
  // embedded-postgres URL. Only pin loopback URLs into `.dev.vars` — same
  // contract as preview/QA needing the local cluster, never Vault production DB.
  if (!isLoopbackPostgresUrl(raw)) return null;
  return raw;
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
  const databaseUrlOverride = readDatabaseUrlOverrideFromEnv();
  if (databaseUrlOverride !== null) {
    lines.push(`DATABASE_URL=${encodeDevVarValue(databaseUrlOverride)}`);
  }

  const body = `${lines.join('\n')}\n`;
  writeFileSync(tmpPath, body, { encoding: 'utf8' });
  renameSync(tmpPath, outPath);

  process.stdout.write(
    `[setup-dev-vars] wrote .dev.vars with keys: ${lines
      .map((l) => l.split('=')[0])
      .join(
        ', '
      )} (DATABASE_URL and other config load from Vault at Worker boot)\n`
  );
}

await main();
