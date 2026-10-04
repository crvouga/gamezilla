import type { Sql, Value } from '@pkgs/sql-shared/sql';
import sql, { ident, join, raw } from '@pkgs/sql-shared/sql';
import fc from 'fast-check';
import type { LogicalColumnType } from './canonical-dump';
import { PG_DDL, SQLITE_DDL } from './canonical-dump';
import type { LogicalSchema, LogicalTable } from './schema';
import type { SqlDialect } from './types';
import { arbValueForType } from './values';

export type RowValues = Record<string, unknown>;

export type ProgramStep =
  | { readonly kind: 'insert'; readonly table: string; readonly row: RowValues }
  | { readonly kind: 'select'; readonly table: string }
  | {
      readonly kind: 'update';
      readonly table: string;
      readonly id: string;
      readonly patch: RowValues;
    }
  | {
      readonly kind: 'soft_delete';
      readonly table: string;
      readonly id: string;
      readonly deletedAt: string;
    }
  | { readonly kind: 'count'; readonly table: string }
  | {
      readonly kind: 'tx_rollback_insert';
      readonly table: string;
      readonly row: RowValues;
    }
  | { readonly kind: 'prepare_select'; readonly table: string };

function ddlType(dialect: SqlDialect, type: LogicalColumnType): string {
  return dialect === 'postgres' ? PG_DDL[type] : SQLITE_DDL[type];
}

export function renderCreateTable(
  dialect: SqlDialect,
  table: LogicalTable
): Sql<void> {
  const cols = table.columns.map((c) => {
    const typeSql = ddlType(dialect, c.type);
    if (c.name === 'id') {
      return `${c.name} ${typeSql} PRIMARY KEY`;
    }
    return `${c.name} ${typeSql}`;
  });
  // Soft-delete column for portable programs.
  cols.push(`deleted_at ${dialect === 'postgres' ? 'timestamptz' : 'TEXT'}`);
  return raw(`CREATE TABLE ${table.name} (${cols.join(', ')})`);
}

function bindColumnValue(table: LogicalTable, name: string, v: unknown): Value {
  const col = table.columns.find((c) => c.name === name);
  if (col?.type === 'json') {
    // Always emit valid JSON text — bare "" is invalid jsonb on Postgres.
    return v === null || v === undefined ? null : JSON.stringify(v);
  }
  if (v !== null && typeof v === 'object' && !(v instanceof Uint8Array)) {
    return JSON.stringify(v);
  }
  return v as Value;
}

export function renderInsert(table: LogicalTable, row: RowValues): Sql<void> {
  const cols = table.columns.map((c) => c.name);
  const values = cols.map((name) => bindColumnValue(table, name, row[name]));
  const colFrags = cols.map((c) => ident(c));
  const valFrags = values.map((v) => sql`${v}`);
  return sql`INSERT INTO ${ident(table.name)} (${join(colFrags)}) VALUES (${join(valFrags)})`;
}

export function renderSelectAll(
  table: LogicalTable
): Sql<Record<string, unknown>> {
  return sql`SELECT * FROM ${ident(table.name)} ORDER BY ${ident('id')}`;
}

export function renderCount(table: LogicalTable): Sql<{ n: number | string }> {
  return sql`SELECT COUNT(*) AS n FROM ${ident(table.name)}`;
}

export function renderUpdate(
  table: LogicalTable,
  id: string,
  patch: RowValues
): Sql<void> {
  const keys = Object.keys(patch);
  const sets = keys.map((key) => {
    const bind = bindColumnValue(table, key, patch[key]);
    return sql`${ident(key)} = ${bind}`;
  });
  return sql`UPDATE ${ident(table.name)} SET ${join(sets)} WHERE ${ident('id')} = ${id}`;
}

export function renderSoftDelete(
  table: LogicalTable,
  id: string,
  deletedAt: string
): Sql<void> {
  return sql`UPDATE ${ident(table.name)} SET ${ident('deleted_at')} = ${deletedAt} WHERE ${ident('id')} = ${id}`;
}

export const arbRowForTable = (
  table: LogicalTable
): fc.Arbitrary<RowValues> => {
  const fields: Record<string, fc.Arbitrary<unknown>> = {};
  for (const col of table.columns) {
    if (col.name === 'id') {
      fields['id'] = fc.uuid();
      continue;
    }
    fields[col.name] = arbValueForType(col.type);
  }
  return fc.record(fields);
};

export const arbProgram = (
  schema: LogicalSchema
): fc.Arbitrary<readonly ProgramStep[]> => {
  const table = schema.tables[0];
  if (table === undefined) {
    return fc.constant([]);
  }
  const arbRow = arbRowForTable(table);
  const step = fc.oneof(
    arbRow.map(
      (row): ProgramStep => ({ kind: 'insert', table: table.name, row })
    ),
    fc.constant({ kind: 'select', table: table.name } satisfies ProgramStep),
    fc.constant({ kind: 'count', table: table.name } satisfies ProgramStep),
    fc.constant({
      kind: 'prepare_select',
      table: table.name,
    } satisfies ProgramStep),
    fc.tuple(arbRow, arbRow).map(([row, patch]): ProgramStep => {
      const { id: _id, ...rest } = patch;
      return {
        kind: 'update',
        table: table.name,
        id: String(row['id']),
        patch: rest,
      };
    }),
    arbRow.map(
      (row): ProgramStep => ({
        kind: 'soft_delete',
        table: table.name,
        id: String(row['id']),
        deletedAt: '2020-06-01T00:00:00.000Z',
      })
    ),
    arbRow.map(
      (row): ProgramStep => ({
        kind: 'tx_rollback_insert',
        table: table.name,
        row,
      })
    )
  );
  return fc.array(step, { minLength: 1, maxLength: 6 });
};
