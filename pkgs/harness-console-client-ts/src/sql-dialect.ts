import type {
  PostgresSqlClient,
  SqlClient,
} from '@pkgs/sql-client-root-shared-ts/interface';

export type SqlDialect = 'postgres' | 'sqlite';

const ANSI_KEYWORDS = [
  'select',
  'from',
  'where',
  'and',
  'or',
  'not',
  'insert',
  'into',
  'values',
  'update',
  'set',
  'delete',
  'create',
  'table',
  'view',
  'index',
  'drop',
  'alter',
  'add',
  'column',
  'primary',
  'key',
  'foreign',
  'references',
  'unique',
  'null',
  'default',
  'as',
  'join',
  'left',
  'right',
  'inner',
  'outer',
  'full',
  'cross',
  'on',
  'using',
  'group',
  'by',
  'having',
  'order',
  'asc',
  'desc',
  'limit',
  'offset',
  'union',
  'all',
  'distinct',
  'case',
  'when',
  'then',
  'else',
  'end',
  'with',
  'recursive',
  'exists',
  'in',
  'between',
  'like',
  'is',
  'true',
  'false',
  'cast',
  'returning',
  'begin',
  'commit',
  'rollback',
  'transaction',
  'if',
] as const;

const SQLITE_EXTRAS = [
  'pragma',
  'autoincrement',
  'without',
  'rowid',
  'vacuum',
  'analyze',
  'attach',
  'detach',
  'replace',
  'upsert',
  'conflict',
  'do',
  'nothing',
  'explain',
  'query',
  'plan',
] as const;

const POSTGRES_EXTRAS = [
  'returning',
  'ilike',
  'similar',
  'to',
  'lateral',
  'window',
  'over',
  'partition',
  'filter',
  'materialized',
  'concurrently',
  'schema',
  'serial',
  'bigserial',
  'jsonb',
  'array',
  'unnest',
  'coalesce',
  'nullif',
  'greatest',
  'least',
  'explain',
  'analyze',
  'verbose',
  'show',
] as const;

export function isPostgresSqlClient(
  sqlClient: SqlClient
): sqlClient is PostgresSqlClient {
  return 'dbScope' in sqlClient;
}

export function detectSqlDialect(sqlClient: SqlClient): SqlDialect {
  return isPostgresSqlClient(sqlClient) ? 'postgres' : 'sqlite';
}

export function sqlKeywordsForDialect(dialect: SqlDialect): readonly string[] {
  if (dialect === 'postgres') {
    return [...ANSI_KEYWORDS, ...POSTGRES_EXTRAS];
  }
  return [...ANSI_KEYWORDS, ...SQLITE_EXTRAS];
}

export function sqlKeywordSet(dialect: SqlDialect): ReadonlySet<string> {
  return new Set(sqlKeywordsForDialect(dialect));
}

export function starterSqlForDialect(dialect: SqlDialect): string {
  if (dialect === 'postgres') {
    return `SELECT table_name\nFROM information_schema.tables\nWHERE table_schema = 'public'\nORDER BY table_name\nLIMIT 50;`;
  }
  return `SELECT name, type\nFROM sqlite_master\nWHERE type IN ('table', 'view')\n  AND name NOT LIKE 'sqlite_%'\nORDER BY name;`;
}
