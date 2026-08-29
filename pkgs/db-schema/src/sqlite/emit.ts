import type { Sql } from '@pkgs/sql';
import { ident, join, raw, sql } from '@pkgs/sql';
import { asValidatedIdent } from '../core/index-fingerprint';
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

type RebuildArgs = {
  readonly table: string;
  readonly declared: ReadonlyDeclaredSchema;
  readonly extras: readonly string[];
  readonly extraTypes: Readonly<Record<string, string>>;
  readonly copyColumns: readonly string[];
  readonly copyAliases?: Readonly<Record<string, string>>;
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
      const cols = op.columns.map((c) => columnDdl(c));
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
        ...(op.copyAliases !== undefined
          ? { copyAliases: op.copyAliases }
          : {}),
      });
    }
    case 'add_check':
    case 'add_foreign_key':
    case 'create_enum':
    case 'add_enum_value': {
      // Applied via rebuild_table when SQLite cannot ALTER.
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

function rebuildColumnDdl(args: RebuildArgs): Sql<void>[] {
  const cols: Sql<void>[] = [];
  for (const name of MANAGED_IMPLICIT_COLUMN_NAMES) {
    cols.push(
      columnDdl({
        name: asValidatedIdent(name),
        type: MANAGED_IMPLICIT_COLUMNS[name],
        isPrimaryKey: name === 'id',
      })
    );
  }
  for (const [name, col] of Object.entries(args.declared.tables[args.table]!)) {
    cols.push(
      columnDdl({
        name: asValidatedIdent(name),
        type: col.type,
        isPrimaryKey: false,
        ...(col.physicalSqlite !== undefined
          ? { physicalSqlite: col.physicalSqlite }
          : {}),
        ...(col.references !== undefined
          ? {
              references: {
                table: asValidatedIdent(col.references.table),
                column: asValidatedIdent(col.references.column),
              },
            }
          : {}),
      })
    );
  }
  for (const name of args.extras) {
    const phys = args.extraTypes[name] ?? 'TEXT';
    const typeSql = raw(
      phys === 'INTEGER' || phys === 'REAL' || phys === 'BLOB' ? phys : 'TEXT'
    );
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
    const destCols = args.copyColumns.map((n) => ident(n));
    const srcCols = args.copyColumns.map((n) => {
      const alias = args.copyAliases?.[n];
      return ident(alias ?? n);
    });
    stmts.push(
      sql`INSERT INTO ${ident(tmp)} (${join(destCols, ', ')}) SELECT ${join(srcCols, ', ')} FROM ${ident(args.table)}`
    );
  }
  stmts.push(
    sql`DROP TABLE ${ident(args.table)}`,
    sql`ALTER TABLE ${ident(tmp)} RENAME TO ${ident(args.table)}`
  );
  return stmts;
}
