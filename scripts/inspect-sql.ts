// @io-wall-ok — inspect SQL helpers (no wall I/O of its own).
import { createRepoTreeObjectStore } from '@pkgs/object-store/repo-tree-store';
import { createSecretAdminStore } from '@pkgs/secret-provider';

export type SecretsEnvName = 'dev' | 'prd';

export type S3Config = {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly region: string;
  readonly endpoint: string | undefined;
  readonly bucket: string | undefined;
};

export type PeerS3 = {
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

export function peerSecretsEnv(active: SecretsEnvName): SecretsEnvName {
  return active === 'dev' ? 'prd' : 'dev';
}

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

export function peerEnvPrefix(peer: SecretsEnvName): string {
  return peer === 'dev' ? 'S3_DEV' : 'S3_PRD';
}

export function peerChildEnv(peer: PeerS3): NodeJS.ProcessEnv {
  const p = peerEnvPrefix(peer.envName);
  const env: NodeJS.ProcessEnv = {
    [`${p}_ACCESS_KEY_ID`]: peer.s3.accessKeyId,
    [`${p}_SECRET_ACCESS_KEY`]: peer.s3.secretAccessKey,
    [`${p}_REGION`]: peer.s3.region,
  };
  if (peer.endpointHost !== undefined) env[`${p}_ENDPOINT`] = peer.endpointHost;
  if (peer.s3.bucket !== undefined) env[`${p}_BUCKET`] = peer.s3.bucket;
  return env;
}

export async function loadPeerS3(
  repoRoot: string,
  peer: SecretsEnvName
): Promise<PeerS3 | null> {
  try {
    const store = await createSecretAdminStore({
      repoRoot,
      configStore: createRepoTreeObjectStore({ rootDir: repoRoot }),
    });
    const secrets = await store.exportSecrets(peer);
    const s3 = readS3FromMap(secrets);
    if (s3 === null) return null;
    return {
      envName: peer,
      s3,
      endpointHost:
        s3.endpoint !== undefined ? toDuckdbS3Endpoint(s3.endpoint) : undefined,
      useSsl: s3.endpoint !== undefined ? endpointUsesSsl(s3.endpoint) : true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `warning: could not load peer S3 secrets (${peer}): ${message}`
    );
    return null;
  }
}

export function renderNamedS3Secret(input: {
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

function postgresViewsSql(): string {
  return `CREATE OR REPLACE VIEW pg_table_sizes AS
SELECT * FROM postgres_query('pg', $$
  SELECT n.nspname AS schema_name, c.relname AS table_name,
    pg_total_relation_size(c.oid) AS total_bytes,
    pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'r'
    AND n.nspname NOT IN ('pg_catalog', 'information_schema')
$$);

CREATE OR REPLACE VIEW pg_row_estimates AS
SELECT * FROM postgres_query('pg', $$
  SELECT schemaname AS schema_name, relname AS table_name,
    n_live_tup::bigint AS estimated_rows
  FROM pg_stat_user_tables
$$);`;
}

function helperQueries(input: {
  readonly s3Bucket: string | undefined;
  readonly peer: PeerS3 | null;
  readonly hasPostgres: boolean;
}): readonly HelperQuery[] {
  const bucketHint = input.s3Bucket ?? 'YOUR_BUCKET';
  const parquetPath = `s3://${bucketHint}/path/to/file.parquet`;
  const queries: HelperQuery[] = [];
  appendPostgresHelpers(queries, input.hasPostgres);
  appendS3Helpers(queries, input.s3Bucket, input.peer);
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

function appendPostgresHelpers(
  queries: HelperQuery[],
  hasPostgres: boolean
): void {
  if (!hasPostgres) return;
  queries.push(
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
    }
  );
}

function appendS3Helpers(
  queries: HelperQuery[],
  s3Bucket: string | undefined,
  peer: PeerS3 | null
): void {
  if (s3Bucket !== undefined) {
    queries.push({
      name: 's3_prefix_bytes',
      description:
        'Count and total bytes of primary S3 objects by top-level prefix',
      sql: `SELECT split_part(file, '/', 4) AS top_prefix, count(*) AS object_count, sum(size) AS total_bytes
FROM s3_objects()
GROUP BY 1
ORDER BY total_bytes DESC NULLS LAST`,
    });
  }
  if (peer?.s3.bucket !== undefined) {
    const macro = `s3_${peer.envName}_objects`;
    queries.push({
      name: `s3_${peer.envName}_prefix_bytes`,
      description: `Count/bytes for ${peer.envName} S3 objects by top-level prefix`,
      sql: `SELECT split_part(file, '/', 4) AS top_prefix, count(*) AS object_count, sum(size) AS total_bytes
FROM ${macro}()
GROUP BY 1
ORDER BY total_bytes DESC NULLS LAST`,
    });
  }
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

function renderPeerSecretAndMacro(peer: PeerS3): string {
  const p = peerEnvPrefix(peer.envName);
  const parts = [
    renderNamedS3Secret({
      name: `s3_${peer.envName}`,
      keyIdEnv: `${p}_ACCESS_KEY_ID`,
      secretEnv: `${p}_SECRET_ACCESS_KEY`,
      regionEnv: `${p}_REGION`,
      endpointEnv:
        peer.endpointHost !== undefined ? `${p}_ENDPOINT` : undefined,
      useSsl: peer.useSsl,
    }),
  ];
  if (peer.s3.bucket !== undefined) {
    parts.push(`CREATE OR REPLACE MACRO s3_${peer.envName}_objects() AS TABLE
SELECT * FROM glob('s3://' || getenv('${p}_BUCKET') || '/**');`);
  }
  return parts.join('\n\n');
}

export function renderInitSql(input: {
  readonly hasEndpoint: boolean;
  readonly useSsl: boolean;
  readonly s3Bucket: string | undefined;
  readonly hasPostgres: boolean;
  readonly peer: PeerS3 | null;
  readonly headless: boolean;
}): { readonly sql: string; readonly queries: readonly HelperQuery[] } {
  const sections = [
    'INSTALL httpfs; INSTALL postgres; INSTALL ui;',
    'LOAD httpfs; LOAD postgres;',
    '',
    renderNamedS3Secret({
      name: 's3_main',
      keyIdEnv: 'S3_ACCESS_KEY_ID',
      secretEnv: 'S3_SECRET_ACCESS_KEY',
      regionEnv: 'S3_REGION',
      endpointEnv: input.hasEndpoint ? 'S3_ENDPOINT' : undefined,
      useSsl: input.useSsl,
    }),
  ];
  if (input.peer !== null) {
    sections.push('', renderPeerSecretAndMacro(input.peer));
  }
  if (input.hasPostgres) {
    sections.push('', "ATTACH '' AS pg (TYPE postgres, READ_ONLY);", '');
    sections.push(postgresViewsSql());
  }
  if (input.s3Bucket !== undefined) {
    sections.push(
      '',
      `CREATE OR REPLACE MACRO s3_objects() AS TABLE
SELECT * FROM glob('s3://' || getenv('S3_BUCKET') || '/**');`
    );
  }
  const queries = helperQueries({
    s3Bucket: input.s3Bucket,
    peer: input.peer,
    hasPostgres: input.hasPostgres,
  });
  sections.push('', renderHelperInserts(queries));
  if (input.headless) sections.push('', 'CALL start_ui_server();');
  return { sql: `${sections.join('\n')}\n`, queries };
}
