#!/usr/bin/env bun
// @io-wall-ok — process entry: DuckDB UI inspect launcher (env from secrets-run).
/**
 * Boots DuckDB UI wired to **both** Infisical envs at once:
 * - Postgres: `pg_prd` / `pg_dev` (whichever have DATABASE_URL)
 * - S3: `s3_prd` / `s3_dev` (+ macros `s3_prd_objects()` / `s3_dev_objects()`)
 *
 * Launch: `bun run inspect` (secrets-run for Infisical auth; both envs loaded
 * via secret admin). Do not run bare.
 */
import { spawn, spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
  type EnvBundle,
  type HelperQuery,
  loadBothEnvs,
  type PgVars,
  parseDatabaseUrl,
  pgChildEnv,
  renderInitSql,
  type SecretsEnvName,
  s3ChildEnv,
  type WiredS3,
  wireS3,
} from './inspect-sql.ts';

const REPO_ROOT = join(import.meta.dirname, '../..');
const DEFAULT_DB_PATH = '.local/inspect.duckdb';
const INSPECT_SHORTHAND = 'bun run inspect';
const INSPECT_FULL =
  'SECRETS_ENV=prd bun run tools/scripts/secrets-run.ts -- bun run tools/scripts/inspect.ts';
const UI_URL = 'http://localhost:4213';
const SECRET_KEY_RE = /secret|password|token|key/i;

type CliFlags = {
  readonly dryRun: boolean;
  readonly headless: boolean;
  readonly dbPath: string;
};

function parseCli(argv: readonly string[]): CliFlags {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      'dry-run': { type: 'boolean', default: false },
      headless: { type: 'boolean', default: false },
      db: { type: 'string' },
    },
    strict: true,
    allowPositionals: false,
  });
  return {
    dryRun: values['dry-run'] === true,
    headless: values.headless === true,
    dbPath: resolve(values.db ?? DEFAULT_DB_PATH),
  };
}

function printLoadError(message: string): void {
  console.error(message);
  console.error('');
  console.error('Likely fix (needs Infisical login + both envs seeded):');
  console.error(`  ${INSPECT_SHORTHAND}`);
  console.error(`  ${INSPECT_FULL}`);
  console.error(
    'Also check `infisical login` / INFISICAL_TOKEN if every secret is missing.'
  );
}

function writeInitSqlFile(sql: string): {
  readonly tmpDir: string;
  readonly initPath: string;
} {
  const tmpDir = mkdtempSync(join(tmpdir(), 'inspect-'));
  const initPath = join(tmpDir, 'init.sql');
  writeFileSync(initPath, sql, { encoding: 'utf8', mode: 0o600 });
  chmodSync(initPath, 0o600);
  return { tmpDir, initPath };
}

function ensureDuckdbOnPath(): void {
  const probe = spawnSync('duckdb', ['--version'], { encoding: 'utf8' });
  if (probe.error !== undefined || probe.status !== 0) {
    console.error('`duckdb` not found on PATH.');
    console.error('Install:');
    console.error('  bun run infra setup');
    console.error('  macOS:  brew install duckdb');
    console.error('  Linux:  curl https://install.duckdb.org | sh');
    process.exit(1);
  }
}

function printDryRun(sql: string, envNames: readonly string[]): void {
  console.log('-- init.sql');
  console.log(sql);
  console.log('-- env var names passed to duckdb (values redacted)');
  for (const name of envNames) {
    const note = SECRET_KEY_RE.test(name) ? ' (secret)' : '';
    console.log(`  ${name}${note}`);
  }
}

function printHelperNames(queries: readonly HelperQuery[]): void {
  console.log('Helper queries seeded into catalog:');
  for (const q of queries) console.log(`  - ${q.name}: ${q.description}`);
  console.log('Run `FROM helper_queries;` in the UI to see full SQL.');
}

function registerCleanup(tmpDir: string): void {
  const cleanup = (): void => {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // best-effort
    }
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => {
    cleanup();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(143);
  });
}

function buildChildEnv(input: {
  readonly s3Stores: readonly WiredS3[];
  readonly postgresEnvs: readonly {
    readonly envName: SecretsEnvName;
    readonly vars: PgVars;
  }[];
}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const wired of input.s3Stores) {
    Object.assign(env, s3ChildEnv(wired));
  }
  for (const pg of input.postgresEnvs) {
    Object.assign(env, pgChildEnv(pg.envName, pg.vars));
  }
  return env;
}

function collectEnvNames(childEnv: NodeJS.ProcessEnv): readonly string[] {
  const names: string[] = [];
  for (const key of Object.keys(childEnv)) {
    if (
      key.startsWith('S3_DEV_') ||
      key.startsWith('S3_PRD_') ||
      key.startsWith('INSPECT_PG_')
    ) {
      names.push(key);
    }
  }
  return names.sort();
}

function planResources(both: {
  readonly dev: EnvBundle;
  readonly prd: EnvBundle;
}): {
  readonly s3Stores: readonly WiredS3[];
  readonly postgresEnvs: readonly {
    readonly envName: SecretsEnvName;
    readonly vars: PgVars;
  }[];
} {
  const s3Stores: WiredS3[] = [];
  for (const bundle of [both.prd, both.dev]) {
    if (bundle.s3 !== null) s3Stores.push(wireS3(bundle.envName, bundle.s3));
  }
  const postgresEnvs: {
    readonly envName: SecretsEnvName;
    readonly vars: PgVars;
  }[] = [];
  for (const bundle of [both.prd, both.dev]) {
    if (bundle.databaseUrl === undefined) continue;
    postgresEnvs.push({
      envName: bundle.envName,
      vars: parseDatabaseUrl(bundle.databaseUrl),
    });
  }
  return { s3Stores, postgresEnvs };
}

async function launchDuckdb(input: {
  readonly initPath: string;
  readonly dbPath: string;
  readonly headless: boolean;
  readonly childEnv: NodeJS.ProcessEnv;
}): Promise<number> {
  mkdirSync(dirname(input.dbPath), { recursive: true });
  const args = ['-init', input.initPath, input.dbPath];
  if (!input.headless) args.push('-ui');

  const child = spawn('duckdb', args, {
    stdio: 'inherit',
    env: input.childEnv,
  });
  return await new Promise<number>((resolveExit) => {
    child.on('error', (err) => {
      console.error(`Failed to spawn duckdb: ${err.message}`);
      resolveExit(1);
    });
    child.on('exit', (code, signal) => {
      if (signal !== null) {
        resolveExit(signal === 'SIGINT' ? 130 : 1);
        return;
      }
      resolveExit(code ?? 1);
    });
  });
}

function printAttachSummary(input: {
  readonly s3Stores: readonly WiredS3[];
  readonly postgresEnvs: readonly { readonly envName: SecretsEnvName }[];
}): void {
  for (const pg of input.postgresEnvs) {
    console.log(`Postgres: pg_${pg.envName} (READ_ONLY)`);
  }
  if (input.postgresEnvs.length === 0) {
    console.log('Postgres: none (no DATABASE_URL in dev or prd)');
  }
  for (const s3 of input.s3Stores) {
    console.log(
      `S3: s3_${s3.envName} bucket=${s3.s3.bucket ?? '<none>'} — FROM s3_${s3.envName}_objects();`
    );
  }
  if (input.s3Stores.length === 0) {
    console.log('S3: none (missing S3 credentials in both envs)');
  }
}

async function main(): Promise<number> {
  const flags = parseCli(process.argv.slice(2));

  let both: { readonly dev: EnvBundle; readonly prd: EnvBundle };
  try {
    both = await loadBothEnvs(REPO_ROOT);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    printLoadError(`Failed to load Infisical secrets for dev+prd: ${message}`);
    return 1;
  }

  const { s3Stores, postgresEnvs } = planResources(both);
  if (s3Stores.length === 0 && postgresEnvs.length === 0) {
    printLoadError(
      'No usable Postgres or S3 secrets found in Infisical envs `dev` or `prd`.'
    );
    return 1;
  }

  const { sql, queries } = renderInitSql({
    postgresEnvs: postgresEnvs.map((p) => p.envName),
    s3Stores,
    headless: flags.headless,
  });
  const childEnv = buildChildEnv({ s3Stores, postgresEnvs });

  if (flags.dryRun) {
    printDryRun(sql, collectEnvNames(childEnv));
    printAttachSummary({ s3Stores, postgresEnvs });
    return 0;
  }

  ensureDuckdbOnPath();
  const { tmpDir, initPath } = writeInitSqlFile(sql);
  registerCleanup(tmpDir);

  printHelperNames(queries);
  printAttachSummary({ s3Stores, postgresEnvs });
  if (flags.headless) console.log(`Headless UI server: ${UI_URL}`);

  return await launchDuckdb({
    initPath,
    dbPath: flags.dbPath,
    headless: flags.headless,
    childEnv,
  });
}

const exitCode = await main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  return 1;
});
process.exit(exitCode);
