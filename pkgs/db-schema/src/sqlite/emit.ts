import type { Sql } from '@pkgs/sql';
import { ident, join, raw, sql } from '@pkgs/sql';
import {
  asPhysicalIdent,
  asSchemaIdent,
  rebuildOldTableIdent,
} from '../core/index-fingerprint';
import type { ClientOperation, CreateTableColumn } from '../core/operations';
import { SQLITE_TYPE_SQL } from '../core/type-map';
import {
  type ColumnType,
  MANAGED_IMPLICIT_COLUMN_NAMES,
  MANAGED_IMPLICIT_COLUMNS,
  type ReadonlyDeclaredSchema,
} from '../core/types';

function sqliteTypeOf(col: {
  type: ColumnType;
  physicalSqlite?: string;
}): string {
  if (col.physicalSqlite !== undefined) return col.physicalSqlite;
  return SQLITE_TYPE_SQL[col.type];
}

function tableChecks(
  declared: ReadonlyDeclaredSchema,
  table: string
): { name: string; expression: string }[] {
  return declared.checks
    .filter((c) => c.table === table)
    .map((c) => ({
      name: c.name,
      expression:
        typeof c.sql === 'string'
          ? c.sql
          : (c.sql.sqlite ?? c.sql.sql),
    }));
}

function columnDdl(col: CreateTableColumn): Sql<void> {
  const typeSql = raw(sqliteTypeOf(col));
  if (col.isPrimaryKey) {
    return sql`${ident(col.name)} ${typeSql} PRIMARY KEY`;
  }
  if (col.references !== undefined) {
    return sql`${ident(col.name)} ${typeSql} REFERENCES ${ident(col.references.table)} (${ident(col.references.column)})`;
  }
  return sql`${ident(col.name)} ${typeSql}`;
}

function checkDdl(name: string, expression: string): Sql<void> {
  return sql`CONSTRAINT ${ident(name)} CHECK (${raw(expression)})`;
}

type RebuildArgs = {
  readonly table: string;
  readonly declared: ReadonlyDeclaredSchema;
  readonly extras: readonly string[];
  readonly extraTypes: Readonly<Record<string, string>>;
  readonly copyColumns: readonly string[];
  readonly copyAliases?: Readonly<Record<string, string>>;
  readonly backfills?: Readonly<Record<string, string>>;
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
      const cols = buildTableColumnDdls(op.table, op.columns, declared);
      return [
        sql`CREATE TABLE IF NOT EXISTS ${ident(op.table)} (${join(cols, ', ')}) STRICT`,
      ];
    }
    case 'add_column': {
      const typeSql = raw(sqliteTypeOf(op));
      return [
        sql`ALTER TABLE ${ident(op.table)} ADD COLUMN ${ident(op.column)} ${typeSql}`,
      ];
    }
    case 'backfill': {
      return [
        sql`UPDATE ${ident(op.table)} SET ${ident(op.column)} = ${raw(op.expression)} WHERE ${ident(op.column)} IS NULL`,
      ];
    }
    case 'create_index': {
      const cols = op.columns.map((c) => ident(c));
      const uniqueKw = op.unique ? raw('UNIQUE ') : raw('');
      return [
        sql`CREATE ${uniqueKw}INDEX IF NOT EXISTS ${ident(op.name)} ON ${ident(op.table)} (${join(cols, ', ')})`,
      ];
    }
    case 'drop_index': {
      return [sql`DROP INDEX IF EXISTS ${ident(op.name)}`];
    }
    case 'drop_table': {
      return [sql`DROP TABLE IF EXISTS ${ident(op.table)}`];
    }
    case 'rebuild_table': {
      return emitRebuild({
        table: op.table,
        declared,
        extras: op.preserveUnderscoreExtras,
        extraTypes: op.preserveExtraTypes,
        copyColumns: op.copyColumns,
        ...(op.copyAliases !== undefined
          ? { copyAliases: op.copyAliases }
          : {}),
        ...(op.backfills !== undefined ? { backfills: op.backfills } : {}),
      });
    }
    case 'add_check':
    case 'add_foreign_key':
    case 'create_enum':
    case 'add_enum_value': {
      return [];
    }
    case 'create_view': {
      return [
        sql`CREATE VIEW IF NOT EXISTS ${ident(op.name)} AS ${raw(op.expression)}`,
      ];
    }
    case 'replace_view': {
      return [
        sql`DROP VIEW IF EXISTS ${ident(op.name)}`,
        sql`CREATE VIEW ${ident(op.name)} AS ${raw(op.expression)}`,
      ];
    }
    case 'drop_view': {
      return [sql`DROP VIEW IF EXISTS ${ident(op.name)}`];
    }
  }
}

function buildTableColumnDdls(
  table: string,
  columns: readonly CreateTableColumn[],
  declared: ReadonlyDeclaredSchema
): Sql<void>[] {
  const cols = columns.map((c) => columnDdl(c));
  for (const check of tableChecks(declared, table)) {
    cols.push(checkDdl(check.name, check.expression));
  }
  return cols;
}

function rebuildColumnDdl(args: RebuildArgs): Sql<void>[] {
  const table = args.table;
  const declaredCols = args.declared.tables[table]!;
  const createCols: CreateTableColumn[] = [];
  for (const name of MANAGED_IMPLICIT_COLUMN_NAMES) {
    createCols.push({
      name: asSchemaIdent(name),
      type: MANAGED_IMPLICIT_COLUMNS[name],
      isPrimaryKey: name === 'id',
    });
  }
  for (const [name, col] of Object.entries(declaredCols)) {
    createCols.push({
      name: asSchemaIdent(name),
      type: col.type,
      isPrimaryKey: false,
      ...(col.physicalSqlite !== undefined
        ? { physicalSqlite: col.physicalSqlite }
        : {}),
      ...(col.references !== undefined
        ? {
            references: {
              table: asSchemaIdent(col.references.table),
              column: asSchemaIdent(col.references.column),
            },
          }
        : {}),
    });
  }
  const cols = buildTableColumnDdls(table, createCols, args.declared);
  for (const name of args.extras) {
    const phys = args.extraTypes[name] ?? 'TEXT';
    const typeSql = raw(
      phys === 'INTEGER' || phys === 'REAL' || phys === 'BLOB' ? phys : 'TEXT'
    );
    cols.push(sql`${ident(asPhysicalIdent(name))} ${typeSql}`);
  }
  return cols;
}

function emitRebuild(args: RebuildArgs): Sql<unknown>[] {
  const oldTable = rebuildOldTableIdent(args.table);
  const cols = rebuildColumnDdl(args);
  const stmts: Sql<unknown>[] = [
    sql`ALTER TABLE ${ident(args.table)} RENAME TO ${ident(oldTable)}`,
    sql`CREATE TABLE ${ident(args.table)} (${join(cols, ', ')}) STRICT`,
  ];
  if (args.copyColumns.length > 0) {
    const destCols = args.copyColumns.map((n) => ident(n));
    const srcCols = args.copyColumns.map((n) => {
      const alias = args.copyAliases?.[n];
      return ident(alias ?? n);
    });
    stmts.push(
      sql`INSERT INTO ${ident(args.table)} (${join(destCols, ', ')}) SELECT ${join(srcCols, ', ')} FROM ${ident(oldTable)}`
    );
  }
  for (const [column, expression] of Object.entries(args.backfills ?? {})) {
    if (args.copyColumns.includes(column)) continue;
    stmts.push(
      sql`UPDATE ${ident(args.table)} SET ${ident(asSchemaIdent(column))} = ${raw(expression)} WHERE ${ident(asSchemaIdent(column))} IS NULL`
    );
  }
  stmts.push(sql`DROP TABLE ${ident(oldTable)}`);
  return stmts;
}
