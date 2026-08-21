#!/usr/bin/env bun
// @io-wall-ok — process entry: DuckDB UI inspect launcher (env from secrets-run).
/**
 * Boots DuckDB UI pre-wired to Postgres + S3 from process.env.
 * Launch via `bun run inspect` (secrets-run injects env). Do not run bare.
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

const REQUIRED_KEYS = [
  'DATABASE_URL',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'S3_REGION',
] as const;

const INSPECT_SHORTHAND = 'bun run inspect';
const INSPECT_FULL =
  'SECRETS_ENV=prd bun run tools/scripts/secrets-run.ts -- bun run scripts/inspect.ts';

const DEFAULT_DB_PATH = '.local/inspect.duckdb';
const UI_URL = 'http://localhost:4213';
const SECRET_KEY_RE = /secret|password|token|key/i;

type PgVars = {
  readonly PGHOST: string;
  readonly PGPORT: string;
  readonly PGUSER: string;
  readonly PGPASSWORD: string;
  readonly PGDATABASE: string;
  readonly PGSSLMODE: string;
};

type InspectEnv = {
  readonly databaseUrl: string;
  readonly s3Endpoint: string | undefined;
  readonly s3Bucket: string | undefined;
};

type EnvResult =
  | { readonly ok: true; readonly env: InspectEnv }
  | { readonly ok: false; readonly missing: readonly string[] };

type CliFlags = {
  readonly dryRun: boolean;
  readonly headless: boolean;
  readonly dbPath: string;
};

type HelperQuery = {
  readonly name: string;
  readonly description: string;
  readonly sql: string;
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

function readEnv(processEnv: NodeJS.ProcessEnv): EnvResult {
  const missing: string[] = [];
  for (const key of REQUIRED_KEYS) {
    const value = processEnv[key]?.trim();
    if (value === undefined || value.length === 0) missing.push(key);
  }
  if (missing.length > 0) return { ok: false, missing };

  const endpoint = processEnv['S3_ENDPOINT']?.trim();
  const bucket = processEnv['S3_BUCKET']?.trim();
  return {
    ok: true,
    env: {
      databaseUrl: processEnv['DATABASE_URL']!.trim(),
      s3Endpoint:
        endpoint !== undefined && endpoint.length > 0 ? endpoint : undefined,
      s3Bucket: bucket !== undefined && bucket.length > 0 ? bucket : undefined,
    },
  };
}

function printMissingEnvError(missing: readonly string[]): void {
  console.error(
    'Missing required environment variables (script was likely run bare, without secrets injection):'
  );
  for (const key of missing) console.error(`  - ${key}`);
  console.error('');
  console.error('Likely fix:');
  console.error(`  ${INSPECT_SHORTHAND}`);
  console.error(`  ${INSPECT_FULL}`);
  if (missing.length === REQUIRED_KEYS.length) {
    console.error('');
    console.error(
      'Every required key is missing — also check `infisical login` / INFISICAL_TOKEN,'
    );
    console.error(
      'and `--recursive` if secrets live under a nested path rather than `/`.'
    );
  }
}

function parseDatabaseUrl(databaseUrl: string): PgVars {
  const url = new URL(databaseUrl);
  const database = url.pathname.replace(/^\//, '');
  if (database.length === 0) {
    throw new Error('DATABASE_URL has no database name in the path');
  }
  return {
    PGHOST: url.hostname,
    PGPORT: url.port.length > 0 ? url.port : '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(database),
    PGSSLMODE: url.searchParams.get('sslmode') ?? 'require',
  };
}

function endpointUsesSsl(endpoint: string): boolean {
  try {
    return new URL(endpoint).protocol !== 'http:';
  } catch {
    return true;
  }
}

/**
 * DuckDB's S3 ENDPOINT wants host[:port] only — it prepends http(s):// from
 * USE_SSL. Our Infisical `S3_ENDPOINT` is a full URL (`https://s3.…`).
 */
function toDuckdbS3Endpoint(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    if (url.port.length > 0) return `${url.hostname}:${url.port}`;
    return url.hostname;
  } catch {
    return endpoint.replace(/^https?:\/\//i, '').replace(/\/$/, '');
  }
}

function helperQueries(s3Bucket: string | undefined): readonly HelperQuery[] {
  const bucketHint = s3Bucket ?? 'YOUR_BUCKET';
  const parquetPath = `s3://${bucketHint}/path/to/file.parquet`;
  const parquetGlob = `s3://${bucketHint}/path/to/*.parquet`;
  return [
    {
      name: 'pg_schemas_tables_sizes',
      description:
        'List Postgres schemas/tables with row estimates and on-disk size',
      sql: `SELECT e.schema_name, e.table_name, e.estimated_rows, s.total_bytes, s.total_size
FROM pg_row_estimates e
LEFT JOIN pg_table_sizes s
  ON e.schema_name = s.schema_name AND e.table_name = s.table_name
ORDER BY s.total_bytes DESC NULLS LAST`,
    },
    {
      name: 'pg_top10_largest',
      description: 'The ten largest Postgres tables by on-disk size',
      sql: `SELECT * FROM pg_table_sizes ORDER BY total_bytes DESC LIMIT 10`,
    },
    {
      name: 's3_prefix_bytes',
      description: 'Count and total bytes of S3 objects by top-level prefix',
      sql: `SELECT
  split_part(file, '/', 4) AS top_prefix,
  count(*) AS object_count,
  sum(size) AS total_bytes
FROM s3_objects
GROUP BY 1
ORDER BY total_bytes DESC NULLS LAST`,
    },
    {
      name: 'parquet_describe',
      description: 'Schema sniff a Parquet file (or glob) on S3',
      sql: `DESCRIBE SELECT * FROM read_parquet('${parquetGlob}')`,
    },
    {
      name: 'parquet_file_metadata',
      description: 'Parquet row groups and compression metadata',
      sql: `SELECT * FROM parquet_file_metadata('${parquetPath}')`,
    },
    {
      name: 'pg_join_parquet_example',
      description: 'Worked example joining a Postgres table to Parquet on S3',
      sql: `SELECT p.*, q.*
FROM pg.public.your_table AS p
JOIN read_parquet('${parquetPath}') AS q
  ON p.id = q.id
LIMIT 100`,
    },
    {
      name: 'duckdb_secrets',
      description: 'List DuckDB secrets (debug auth wiring)',
      sql: `FROM duckdb_secrets()`,
    },
    {
      name: 'which_secret_s3',
      description: 'Which secret applies to a sample S3 Parquet path',
      sql: `FROM which_secret('${parquetPath}', 's3')`,
    },
  ];
}

function renderS3SecretSql(hasEndpoint: boolean, useSsl: boolean): string {
  const lines = [
    'CREATE OR REPLACE SECRET s3_main (',
    '    TYPE s3,',
    '    PROVIDER config,',
    "    KEY_ID getenv('S3_ACCESS_KEY_ID'),",
    "    SECRET getenv('S3_SECRET_ACCESS_KEY'),",
    hasEndpoint
      ? "    REGION getenv('S3_REGION'),"
      : "    REGION getenv('S3_REGION')",
  ];
  if (hasEndpoint) {
    lines.push("    ENDPOINT getenv('S3_ENDPOINT'),");
    lines.push("    URL_STYLE 'path',");
    lines.push(`    USE_SSL ${useSsl ? 'true' : 'false'}`);
  }
  lines.push(');');
  return lines.join('\n');
}

function renderViewsSql(hasBucket: boolean): string {
  const parts = [
    `CREATE OR REPLACE VIEW pg_table_sizes AS
SELECT * FROM postgres_query('pg', $$
  SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    pg_total_relation_size(c.oid) AS total_bytes,
    pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'r'
    AND n.nspname NOT IN ('pg_catalog', 'information_schema')
$$);`,
    `CREATE OR REPLACE VIEW pg_row_estimates AS
SELECT * FROM postgres_query('pg', $$
  SELECT
    schemaname AS schema_name,
    relname AS table_name,
    n_live_tup::bigint AS estimated_rows
  FROM pg_stat_user_tables
$$);`,
  ];
  if (hasBucket) {
    parts.push(`CREATE OR REPLACE VIEW s3_objects AS
SELECT * FROM glob('s3://' || getenv('S3_BUCKET') || '/**');`);
  }
  return parts.join('\n\n');
}

function renderHelperInserts(queries: readonly HelperQuery[]): string {
  const values = queries.map((q) => {
    const desc = q.description.replace(/'/g, "''");
    return `('${q.name}', '${desc}', $$${q.sql}$$)`;
  });
  return `CREATE TABLE helper_queries (
    name TEXT,
    description TEXT,
    sql TEXT
);

INSERT INTO helper_queries VALUES
${values.join(',\n')};`;
}

function renderInitSql(input: {
  readonly hasEndpoint: boolean;
  readonly useSsl: boolean;
  readonly s3Bucket: string | undefined;
  readonly headless: boolean;
}): string {
  const queries = helperQueries(input.s3Bucket);
  const sections = [
    'INSTALL httpfs; INSTALL postgres; INSTALL ui;',
    'LOAD httpfs; LOAD postgres;',
    '',
    renderS3SecretSql(input.hasEndpoint, input.useSsl),
    '',
    "ATTACH '' AS pg (TYPE postgres, READ_ONLY);",
    '',
    renderViewsSql(input.s3Bucket !== undefined),
    '',
    renderHelperInserts(queries),
  ];
  if (input.headless) {
    sections.push('', 'CALL start_ui_server();');
  }
  return `${sections.join('\n')}\n`;
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

function envNamesForChild(pgVars: PgVars): readonly string[] {
  const names = [
    ...REQUIRED_KEYS,
    'S3_ENDPOINT',
    'S3_BUCKET',
    ...Object.keys(pgVars),
  ];
  return [...new Set(names)].sort();
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

async function launchDuckdb(input: {
  readonly initPath: string;
  readonly dbPath: string;
  readonly headless: boolean;
  readonly pgVars: PgVars;
  readonly s3EndpointHost: string | undefined;
}): Promise<number> {
  mkdirSync(dirname(input.dbPath), { recursive: true });
  const args = ['-init', input.initPath, input.dbPath];
  if (!input.headless) args.push('-ui');

  const env: NodeJS.ProcessEnv = { ...process.env, ...input.pgVars };
  if (input.s3EndpointHost !== undefined) {
    env['S3_ENDPOINT'] = input.s3EndpointHost;
  }

  const child = spawn('duckdb', args, {
    stdio: 'inherit',
    env,
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

async function main(): Promise<number> {
  const flags = parseCli(process.argv.slice(2));
  const envResult = readEnv(process.env);
  if (!envResult.ok) {
    printMissingEnvError(envResult.missing);
    return 1;
  }

  const { env } = envResult;
  const pgVars = parseDatabaseUrl(env.databaseUrl);
  const s3EndpointHost =
    env.s3Endpoint !== undefined
      ? toDuckdbS3Endpoint(env.s3Endpoint)
      : undefined;
  const useSsl =
    env.s3Endpoint !== undefined ? endpointUsesSsl(env.s3Endpoint) : true;
  const sql = renderInitSql({
    hasEndpoint: env.s3Endpoint !== undefined,
    useSsl,
    s3Bucket: env.s3Bucket,
    headless: flags.headless,
  });
  const queries = helperQueries(env.s3Bucket);

  if (flags.dryRun) {
    printDryRun(sql, envNamesForChild(pgVars));
    if (s3EndpointHost !== undefined && env.s3Endpoint !== s3EndpointHost) {
      console.log(
        `-- S3_ENDPOINT rewritten for DuckDB: <url> → ${s3EndpointHost}`
      );
    }
    return 0;
  }

  ensureDuckdbOnPath();
  const { tmpDir, initPath } = writeInitSqlFile(sql);
  registerCleanup(tmpDir);

  printHelperNames(queries);
  if (flags.headless) {
    console.log(`Headless UI server: ${UI_URL}`);
  }

  return await launchDuckdb({
    initPath,
    dbPath: flags.dbPath,
    headless: flags.headless,
    pgVars,
    s3EndpointHost,
  });
}

const exitCode = await main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  return 1;
});
process.exit(exitCode);
