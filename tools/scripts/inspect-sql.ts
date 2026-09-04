// @io-wall-ok — inspect SQL + dual-env secret loading helpers.
import { createRepoTreeObjectStore } from '@pkgs/object-store-node-fs/repo-tree-store';
import { createSecretAdminStore } from '@pkgs/secret-provider';

export type SecretsEnvName = 'dev' | 'prd';

export type S3Config = {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly region: string;
  readonly endpoint: string | undefined;
  readonly bucket: string | undefined;
};

export type PgVars = {
  readonly PGHOST: string;
  readonly PGPORT: string;
  readonly PGUSER: string;
  readonly PGPASSWORD: string;
  readonly PGDATABASE: string;
  readonly PGSSLMODE: string;
};

export type EnvBundle = {
  readonly envName: SecretsEnvName;
  readonly databaseUrl: string | undefined;
  readonly s3: S3Config | null;
};

export type WiredS3 = {
  readonly envName: SecretsEnvName;
  readonly s3: S3Config;
  readonly endpointHost: string | undefined;
  readonly useSsl: boolean;
};

export type HelperQuery = {
  readonly name: string;
  readonly description: string;
  readonly sql: string;
};

export function endpointUsesSsl(endpoint: string): boolean {
  try {
    return new URL(endpoint).protocol !== 'http:';
  } catch {
    return true;
  }
}

/** DuckDB ENDPOINT is host[:port]; Infisical stores a full https URL. */
export function toDuckdbS3Endpoint(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    if (url.port.length > 0) return `${url.hostname}:${url.port}`;
    return url.hostname;
  } catch {
    return endpoint.replace(/^https?:\/\//i, '').replace(/\/$/, '');
  }
}

export function readS3FromMap(
  map: ReadonlyMap<string, string>
): S3Config | null {
  const accessKeyId = (
    map.get('S3_ACCESS_KEY_ID') ??
    map.get('B2_APP_KEY_ID') ??
    ''
  ).trim();
  const secretAccessKey = (
    map.get('S3_SECRET_ACCESS_KEY') ??
    map.get('B2_APP_KEY') ??
    ''
  ).trim();
  const region = (map.get('S3_REGION') ?? '').trim();
  if (
    accessKeyId.length === 0 ||
    secretAccessKey.length === 0 ||
    region.length === 0
  ) {
    return null;
  }
  const endpoint = (map.get('S3_ENDPOINT') ?? '').trim();
  const bucket = (map.get('S3_BUCKET') ?? '').trim();
  return {
    accessKeyId,
    secretAccessKey,
    region,
    endpoint: endpoint.length > 0 ? endpoint : undefined,
    bucket: bucket.length > 0 ? bucket : undefined,
  };
}

export function parseDatabaseUrl(databaseUrl: string): PgVars {
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

export function s3EnvPrefix(envName: SecretsEnvName): string {
  return envName === 'dev' ? 'S3_DEV' : 'S3_PRD';
}

export function pgEnvPrefix(envName: SecretsEnvName): string {
  return envName === 'dev' ? 'INSPECT_PG_DEV' : 'INSPECT_PG_PRD';
}

/** Discrete PG_* fields for CREATE SECRET … getenv (ATTACH cannot take getenv). */
export function pgChildEnv(
  envName: SecretsEnvName,
  vars: PgVars
): NodeJS.ProcessEnv {
  const p = pgEnvPrefix(envName);
  return {
    [`${p}_HOST`]: vars.PGHOST,
    [`${p}_PORT`]: vars.PGPORT,
    [`${p}_DATABASE`]: vars.PGDATABASE,
    [`${p}_USER`]: vars.PGUSER,
    [`${p}_PASSWORD`]: vars.PGPASSWORD,
    [`${p}_SSLMODE`]: vars.PGSSLMODE,
  };
}

export function wireS3(envName: SecretsEnvName, s3: S3Config): WiredS3 {
  return {
    envName,
    s3,
    endpointHost:
      s3.endpoint !== undefined ? toDuckdbS3Endpoint(s3.endpoint) : undefined,
    useSsl: s3.endpoint !== undefined ? endpointUsesSsl(s3.endpoint) : true,
  };
}

export function s3ChildEnv(wired: WiredS3): NodeJS.ProcessEnv {
  const p = s3EnvPrefix(wired.envName);
  const env: NodeJS.ProcessEnv = {
    [`${p}_ACCESS_KEY_ID`]: wired.s3.accessKeyId,
    [`${p}_SECRET_ACCESS_KEY`]: wired.s3.secretAccessKey,
    [`${p}_REGION`]: wired.s3.region,
  };
  if (wired.endpointHost !== undefined) {
    env[`${p}_ENDPOINT`] = wired.endpointHost;
  }
  if (wired.s3.bucket !== undefined) env[`${p}_BUCKET`] = wired.s3.bucket;
  return env;
}

async function loadOneEnv(
  repoRoot: string,
  envName: SecretsEnvName
): Promise<EnvBundle> {
  const store = await createSecretAdminStore({
    repoRoot,
    configStore: createRepoTreeObjectStore({ rootDir: repoRoot }),
  });
  const secrets = await store.exportSecrets(envName);
  const databaseUrl = (secrets.get('DATABASE_URL') ?? '').trim();
  return {
    envName,
    databaseUrl: databaseUrl.length > 0 ? databaseUrl : undefined,
    s3: readS3FromMap(secrets),
  };
}

/** Load both Infisical envs (dev + prd) for a dual-attach inspect session. */
export async function loadBothEnvs(
  repoRoot: string
): Promise<{ readonly dev: EnvBundle; readonly prd: EnvBundle }> {
  const [dev, prd] = await Promise.all([
    loadOneEnv(repoRoot, 'dev'),
    loadOneEnv(repoRoot, 'prd'),
  ]);
  return { dev, prd };
}

function renderNamedS3Secret(input: {
  readonly name: string;
  readonly keyIdEnv: string;
  readonly secretEnv: string;
  readonly regionEnv: string;
  readonly endpointEnv: string | undefined;
  readonly useSsl: boolean;
}): string {
  const lines = [
    `CREATE OR REPLACE SECRET ${input.name} (`,
    '    TYPE s3,',
    '    PROVIDER config,',
    `    KEY_ID getenv('${input.keyIdEnv}'),`,
    `    SECRET getenv('${input.secretEnv}'),`,
    input.endpointEnv !== undefined
      ? `    REGION getenv('${input.regionEnv}'),`
      : `    REGION getenv('${input.regionEnv}')`,
  ];
  if (input.endpointEnv !== undefined) {
    lines.push(`    ENDPOINT getenv('${input.endpointEnv}'),`);
    lines.push("    URL_STYLE 'path',");
    lines.push(`    USE_SSL ${input.useSsl ? 'true' : 'false'}`);
  }
  lines.push(');');
  return lines.join('\n');
}

function renderS3Block(wired: WiredS3): string {
  const p = s3EnvPrefix(wired.envName);
  const parts = [
    renderNamedS3Secret({
      name: `s3_${wired.envName}`,
      keyIdEnv: `${p}_ACCESS_KEY_ID`,
      secretEnv: `${p}_SECRET_ACCESS_KEY`,
      regionEnv: `${p}_REGION`,
      endpointEnv:
        wired.endpointHost !== undefined ? `${p}_ENDPOINT` : undefined,
      useSsl: wired.useSsl,
    }),
  ];
  if (wired.s3.bucket !== undefined) {
    parts.push(`CREATE OR REPLACE MACRO s3_${wired.envName}_objects() AS TABLE
SELECT * FROM glob('s3://' || getenv('${p}_BUCKET') || '/**');`);
  }
  return parts.join('\n\n');
}

function postgresViewsSql(alias: string): string {
  return `CREATE OR REPLACE VIEW ${alias}_table_sizes AS
SELECT * FROM postgres_query('${alias}', $$
  SELECT n.nspname AS schema_name, c.relname AS table_name,
    pg_total_relation_size(c.oid) AS total_bytes,
    pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'r'
    AND n.nspname NOT IN ('pg_catalog', 'information_schema')
$$);

CREATE OR REPLACE VIEW ${alias}_row_estimates AS
SELECT * FROM postgres_query('${alias}', $$
  SELECT schemaname AS schema_name, relname AS table_name,
    n_live_tup::bigint AS estimated_rows
  FROM pg_stat_user_tables
$$);`;
}

function renderHelperInserts(queries: readonly HelperQuery[]): string {
  const values = queries.map((q) => {
    const desc = q.description.replace(/'/g, "''");
    return `('${q.name}', '${desc}', $$${q.sql}$$)`;
  });
  return `CREATE OR REPLACE TABLE helper_queries (
    name TEXT,
    description TEXT,
    sql TEXT
);
INSERT INTO helper_queries VALUES
${values.join(',\n')};`;
}

function appendPgHelpers(
  queries: HelperQuery[],
  envName: SecretsEnvName
): void {
  const alias = `pg_${envName}`;
  queries.push(
    {
      name: `${alias}_schemas_tables_sizes`,
      description: `${envName} Postgres: schemas/tables with row estimates + size`,
      sql: `SELECT e.schema_name, e.table_name, e.estimated_rows, s.total_bytes, s.total_size
FROM ${alias}_row_estimates e
LEFT JOIN ${alias}_table_sizes s
  ON e.schema_name = s.schema_name AND e.table_name = s.table_name
ORDER BY s.total_bytes DESC NULLS LAST`,
    },
    {
      name: `${alias}_top10_largest`,
      description: `${envName} Postgres: ten largest tables`,
      sql: `SELECT * FROM ${alias}_table_sizes ORDER BY total_bytes DESC LIMIT 10`,
    }
  );
}

function appendS3Helpers(queries: HelperQuery[], wired: WiredS3): void {
  if (wired.s3.bucket === undefined) return;
  const macro = `s3_${wired.envName}_objects`;
  queries.push({
    name: `s3_${wired.envName}_prefix_bytes`,
    description: `${wired.envName} S3: count/bytes by top-level prefix`,
    sql: `SELECT split_part(file, '/', 4) AS top_prefix, count(*) AS object_count, sum(size) AS total_bytes
FROM ${macro}()
GROUP BY 1
ORDER BY total_bytes DESC NULLS LAST`,
  });
}

function buildHelperQueries(input: {
  readonly postgresEnvs: readonly SecretsEnvName[];
  readonly s3Stores: readonly WiredS3[];
}): readonly HelperQuery[] {
  const queries: HelperQuery[] = [];
  for (const envName of input.postgresEnvs) appendPgHelpers(queries, envName);
  for (const wired of input.s3Stores) appendS3Helpers(queries, wired);
  const bucketHint =
    input.s3Stores.find((s) => s.s3.bucket !== undefined)?.s3.bucket ??
    'YOUR_BUCKET';
  const parquetPath = `s3://${bucketHint}/path/to/file.parquet`;
  queries.push(
    {
      name: 'parquet_describe',
      description: 'Schema sniff a Parquet file (or glob) on S3',
      sql: `DESCRIBE SELECT * FROM read_parquet('s3://${bucketHint}/path/to/*.parquet')`,
    },
    {
      name: 'parquet_file_metadata',
      description: 'Parquet row groups and compression metadata',
      sql: `SELECT * FROM parquet_file_metadata('${parquetPath}')`,
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
    }
  );
  return queries;
}

function renderPostgresBlock(envName: SecretsEnvName): string {
  const alias = `pg_${envName}`;
  const secret = `${alias}_secret`;
  const p = pgEnvPrefix(envName);
  return `CREATE OR REPLACE SECRET ${secret} (
    TYPE postgres,
    HOST getenv('${p}_HOST'),
    PORT getenv('${p}_PORT'),
    DATABASE getenv('${p}_DATABASE'),
    USER getenv('${p}_USER'),
    PASSWORD getenv('${p}_PASSWORD'),
    SSLMODE getenv('${p}_SSLMODE')
);

ATTACH '' AS ${alias} (TYPE postgres, SECRET ${secret}, READ_ONLY);

${postgresViewsSql(alias)}`;
}

export function renderInitSql(input: {
  readonly postgresEnvs: readonly SecretsEnvName[];
  readonly s3Stores: readonly WiredS3[];
  readonly headless: boolean;
}): { readonly sql: string; readonly queries: readonly HelperQuery[] } {
  const sections = [
    'INSTALL httpfs; INSTALL postgres; INSTALL ui;',
    'LOAD httpfs; LOAD postgres;',
  ];

  for (const wired of input.s3Stores) {
    sections.push('', renderS3Block(wired));
  }

  for (const envName of input.postgresEnvs) {
    sections.push('', renderPostgresBlock(envName));
  }

  const queries = buildHelperQueries({
    postgresEnvs: input.postgresEnvs,
    s3Stores: input.s3Stores,
  });
  sections.push('', renderHelperInserts(queries));
  if (input.headless) sections.push('', 'CALL start_ui_server();');
  return { sql: `${sections.join('\n')}\n`, queries };
}
