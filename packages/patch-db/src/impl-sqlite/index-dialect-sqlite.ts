/**
 * SQLite compiler for declarative snapshot indexes ({@link IndexDialect}).
 *
 * Compiles {@link NormalizedIndexSpec}s into expression / partial `CREATE INDEX`
 * DDL on the patch-db `snapshots` table using `json_extract(attributes, '$."<key>"')`
 * for attribute extraction and `IS [NOT] NULL` for presence/absence predicates.
 * Introspects `sqlite_master` filtered to the library's owned name prefix; the
 * reconciler never touches indexes outside that prefix.
 */
import type { SqlClient } from '@gamezilla/sql-client/interface';
import type { IndexDialect } from '../indexes/dialect';
import type {
  NormalizedIndexField,
  NormalizedIndexSpec,
  NormalizedIndexWhere,
} from '../indexes/index-spec';

function quoteSqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/** SQLite JSON path for a namespaced attribute key, e.g. `space/host-id` ->
 * `$."space/host-id"`. Always quoted because keys contain `/` (and may
 * contain `.`), and the inner double-quotes are escaped per the SQL/JSON spec. */
function sqliteJsonPath(attribute: string): string {
  return `$."${attribute.replace(/"/g, '""')}"`;
}

function sqliteColumnExpression(column: NormalizedIndexField): string {
  switch (column.kind) {
    case 'entityId':
      return 'entity_id';
    case 'entityType':
      return 'entity_type';
    case 'attribute':
      return `json_extract(attributes, ${quoteSqlString(sqliteJsonPath(column.attribute))})`;
  }
}

function sqliteWhereExpression(where: NormalizedIndexWhere): string {
  const path = quoteSqlString(sqliteJsonPath(where.attribute));
  const expr = `json_extract(attributes, ${path})`;
  return where.kind === 'attributeExists'
    ? `${expr} IS NOT NULL`
    : `${expr} IS NULL`;
}

function sqliteWhereClause(spec: NormalizedIndexSpec): string {
  const parts = [`entity_type = ${quoteSqlString(spec.entityType)}`];
  for (const w of spec.where) parts.push(sqliteWhereExpression(w));
  return parts.join(' AND ');
}

export function sqliteDdlCreate(spec: NormalizedIndexSpec): string {
  const cols = spec.fields.map(sqliteColumnExpression).join(', ');
  return `CREATE INDEX IF NOT EXISTS ${quoteIdentifier(spec.dbName)} ON snapshots (${cols}) WHERE ${sqliteWhereClause(spec)}`;
}

export function sqliteDdlDrop(indexName: string): string {
  return `DROP INDEX IF EXISTS ${quoteIdentifier(indexName)}`;
}

async function sqliteIntrospect(args: {
  sqlClient: SqlClient;
  ownedNamePrefix: string;
}): Promise<readonly string[]> {
  const rows = await args.sqlClient.query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'snapshots' AND name LIKE ?`,
    [`${args.ownedNamePrefix}%`]
  );
  return rows.map((r) => r.name);
}

export const sqliteIndexDialect: IndexDialect = {
  introspect: sqliteIntrospect,
  ddlCreate: sqliteDdlCreate,
  ddlDrop: sqliteDdlDrop,
};
