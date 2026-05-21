/**
 * Postgres compiler for declarative snapshot indexes ({@link IndexDialect}).
 *
 * Compiles {@link NormalizedIndexSpec}s into expression / partial `CREATE INDEX`
 * DDL on the patch-db `snapshots` table (e.g. `(attributes->>'space/host-id')`,
 * `WHERE entity_type = 'space' AND NOT (attributes ? 'space/ended-at')`).
 * Introspects `pg_indexes` filtered to the library's owned name prefix; the
 * reconciler never touches indexes outside that prefix.
 *
 * Every keyword / entity-type embedded in the emitted DDL has already been
 * validated by {@link normalizeIndexSpec} (`assertAttribute`,
 * `assertEntityType`), and string literals are still SQL-escaped for defense
 * in depth.
 */
import type { SqlClient } from '@pkgs/sql-client/interface';
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

function pgColumnExpression(column: NormalizedIndexField): string {
  switch (column.kind) {
    case 'entityId':
      return 'entity_id';
    case 'entityType':
      return 'entity_type';
    case 'attribute':
      return `(attributes->>${quoteSqlString(column.attribute)})`;
  }
}

function pgWhereExpression(where: NormalizedIndexWhere): string {
  const lit = quoteSqlString(where.attribute);
  return where.kind === 'attributeExists'
    ? `(attributes ? ${lit})`
    : `NOT (attributes ? ${lit})`;
}

function pgWhereClause(spec: NormalizedIndexSpec): string {
  const parts = [`entity_type = ${quoteSqlString(spec.entityType)}`];
  for (const w of spec.where) parts.push(pgWhereExpression(w));
  return parts.join(' AND ');
}

export function postgresDdlCreate(spec: NormalizedIndexSpec): string {
  const cols = spec.fields.map(pgColumnExpression).join(', ');
  return `CREATE INDEX IF NOT EXISTS ${quoteIdentifier(spec.dbName)} ON snapshots (${cols}) WHERE ${pgWhereClause(spec)}`;
}

export function postgresDdlDrop(indexName: string): string {
  return `DROP INDEX IF EXISTS ${quoteIdentifier(indexName)}`;
}

async function postgresIntrospect(args: {
  sqlClient: SqlClient;
  ownedNamePrefix: string;
}): Promise<readonly string[]> {
  const rows = await args.sqlClient.query<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes WHERE schemaname = current_schema() AND tablename = 'snapshots' AND indexname LIKE ?`,
    [`${args.ownedNamePrefix}%`]
  );
  return rows.map((r) => r.indexname);
}

export const postgresIndexDialect: IndexDialect = {
  introspect: postgresIntrospect,
  ddlCreate: postgresDdlCreate,
  ddlDrop: postgresDdlDrop,
};
