import type { Sql } from '@pkgs/sql';
import { ident, join, raw, sql } from '@pkgs/sql';
import { asValidatedIdent } from '../core/index-fingerprint';
import type { ClientOperation } from '../core/operations';
import { SQLITE_TYPE_SQL } from '../core/type-map';
import {
  type ColumnType,
  MANAGED_IMPLICIT_COLUMN_NAMES,
  MANAGED_IMPLICIT_COLUMNS,
  type ReadonlyDeclaredSchema,
} from '../core/types';

function columnDdl(
  name: string,
  type: ColumnType,
  isPrimaryKey: boolean
): Sql<void> {
  const typeSql = raw(SQLITE_TYPE_SQL[type]);
  if (isPrimaryKey) {
    return sql`${ident(name)} ${typeSql} PRIMARY KEY`;
  }
  return sql`${ident(name)} ${typeSql}`;
}

type RebuildArgs = {
  readonly table: string;
  readonly declared: ReadonlyDeclaredSchema;
  readonly extras: readonly string[];
  readonly extraTypes: Readonly<Record<string, string>>;
  readonly copyColumns: readonly string[];
};

/**
 * Emit SQLite DDL for a client operation. Rebuilds preserve non-managed
 * `_`-prefixed columns.
 */
export function emitClientOperation(
  op: ClientOperation,
  declared: ReadonlyDeclaredSchema
): Sql<unknown>[] {
  switch (op.kind) {
    case 'create_table': {
      const cols = op.columns.map((c) =>
        columnDdl(c.name, c.type, c.isPrimaryKey)
      );
      return [
        sql`CREATE TABLE IF NOT EXISTS ${ident(op.table)} (${join(cols, ', ')}) STRICT`,
      ];
    }
    case 'add_column': {
      const typeSql = raw(SQLITE_TYPE_SQL[op.type]);
      return [
        sql`ALTER TABLE ${ident(op.table)} ADD COLUMN ${ident(op.column)} ${typeSql}`,
      ];
    }
    case 'create_index': {
      const cols = op.columns.map((c) => ident(c));
      return [
        sql`CREATE INDEX IF NOT EXISTS ${ident(op.name)} ON ${ident(op.table)} (${join(cols, ', ')})`,
      ];
    }
    case 'drop_index': {
      return [sql`DROP INDEX IF EXISTS ${ident(op.name)}`];
    }
    case 'drop_table': {
      return [sql`DROP TABLE IF EXISTS ${ident(op.table)}`];
    }
    case 'drop_column': {
      return emitRebuild({
        table: op.table,
        declared,
        extras: [],
        extraTypes: {},
        copyColumns: [],
      });
    }
    case 'rebuild_table': {
      return emitRebuild({
        table: op.table,
        declared,
        extras: op.preserveUnderscoreExtras,
        extraTypes: op.preserveExtraTypes,
        copyColumns: op.copyColumns,
      });
    }
  }
}

function rebuildColumnDdl(args: RebuildArgs): Sql<void>[] {
  const cols: Sql<void>[] = [];
  for (const name of MANAGED_IMPLICIT_COLUMN_NAMES) {
    cols.push(columnDdl(name, MANAGED_IMPLICIT_COLUMNS[name], name === '_id'));
  }
  for (const [name, type] of Object.entries(
    args.declared.tables[args.table]!
  )) {
    cols.push(columnDdl(name, type, false));
  }
  for (const name of args.extras) {
    const phys = args.extraTypes[name] ?? 'TEXT';
    const typeSql = raw(phys === 'INTEGER' ? 'INTEGER' : 'TEXT');
    cols.push(sql`${ident(name)} ${typeSql}`);
  }
  return cols;
}

function emitRebuild(args: RebuildArgs): Sql<unknown>[] {
  const tmp = asValidatedIdent(`_tmp_${args.table}`);
  const cols = rebuildColumnDdl(args);
  const stmts: Sql<unknown>[] = [
    sql`CREATE TABLE ${ident(tmp)} (${join(cols, ', ')}) STRICT`,
  ];
  if (args.copyColumns.length > 0) {
    const copyList = join(
      args.copyColumns.map((n) => ident(n)),
      ', '
    );
    stmts.push(
      sql`INSERT INTO ${ident(tmp)} (${copyList}) SELECT ${copyList} FROM ${ident(args.table)}`
    );
  }
  stmts.push(
    sql`DROP TABLE ${ident(args.table)}`,
    sql`ALTER TABLE ${ident(tmp)} RENAME TO ${ident(args.table)}`
  );
  return stmts;
}
