import { resolveBackfillSql } from './backfill';
import type { ClassifiedDelta } from './compatibility';
import { classifyDelta, desiredColumns, findColumn, retiredColumnsOf } from './compatibility';
import { POSTGRES_CAPS } from './dialect-caps';
import {
  asPackageIndexName,
  asSchemaIdent,
  fingerprintForIndexDef,
} from './index-fingerprint';
import type {
  CreateTableColumn,
  PlanServerResult,
  ServerOperation,
} from './operations';
import type {
  DeclaredColumn,
  IndexDef,
  IntrospectedCatalog,
  ReadonlyDeclaredSchema,
} from './types';
import {
  MANAGED_IMPLICIT_COLUMN_NAMES,
  MANAGED_IMPLICIT_COLUMNS,
} from './types';

export type PlanServerOptions = {
  /** Restrict the plan to table DDL or index DDL (default `all`). */
  readonly operations?: 'all' | 'table' | 'index';
};

function createTableColumns(
  declared: ReadonlyDeclaredSchema,
  table: string
): CreateTableColumn[] {
  const columns: CreateTableColumn[] = [];
  for (const name of MANAGED_IMPLICIT_COLUMN_NAMES) {
    columns.push({
      name: asSchemaIdent(name),
      type: MANAGED_IMPLICIT_COLUMNS[name],
      isPrimaryKey: name === 'id',
    });
  }
  for (const [name, col] of Object.entries(declared.tables[table]!)) {
    columns.push(toCreateColumn(name, col));
  }
  // Tombstoned columns are still materialized: that is what guarantees an
  // older client can always read them from a fresh database.
  for (const retired of retiredColumnsOf(declared, table)) {
    if (retired.name in declared.tables[table]!) continue;
    columns.push({
      name: asSchemaIdent(retired.name),
      type: retired.type,
      isPrimaryKey: false,
    });
  }
  return columns;
}

function toCreateColumn(name: string, col: DeclaredColumn): CreateTableColumn {
  return {
    name: asSchemaIdent(name),
    type: col.type,
    isPrimaryKey: false,
    ...(col.physicalPostgres !== undefined
      ? { physicalPostgres: col.physicalPostgres }
      : {}),
    ...(col.physicalSqlite !== undefined
      ? { physicalSqlite: col.physicalSqlite }
      : {}),
  };
}

export function planIndexOperations(
  declared: ReadonlyDeclaredSchema,
  catalog: IntrospectedCatalog
): ServerOperation[] {
  const creates: ServerOperation[] = [];
  const drops: ServerOperation[] = [];
  const desiredIndexNames = new Set<string>();

  const pushCreate = (def: IndexDef, unique: boolean): void => {
    const name = fingerprintForIndexDef(def, unique);
    desiredIndexNames.add(name);
    if (catalog.indexes.some((ix) => ix.name === name && ix.invalid !== true)) {
      return;
    }
    const [table, ...columns] = def;
    creates.push({
      kind: 'create_index',
      name,
      table: asSchemaIdent(table),
      columns: columns.map((c) => asSchemaIdent(c)),
      unique,
    });
  };

  for (const def of declared.indexes) {
    pushCreate(def, false);
  }
  for (const def of declared.uniqueIndexes) {
    pushCreate(def, true);
  }

  for (const ix of catalog.indexes) {
    const branded = asPackageIndexName(ix.name);
    if (!branded) continue;
    if (ix.invalid === true) {
      drops.push({ kind: 'drop_index', name: branded });
      continue;
    }
    if (desiredIndexNames.has(branded)) continue;
    drops.push({ kind: 'drop_index', name: branded });
  }
  // Drops before creates: an invalid index still occupies its name, so it must
  // be removed before `CREATE INDEX` can take the name back.
  return [...drops, ...creates];
}

function planColumnAdds(
  declared: ReadonlyDeclaredSchema,
  catalog: IntrospectedCatalog
): ServerOperation[] {
  const ops: ServerOperation[] = [];
  for (const tableName of Object.keys(declared.tables)) {
    const existing = catalog.tables.get(tableName);
    if (!existing) {
      ops.push({
        kind: 'create_table',
        table: asSchemaIdent(tableName),
        columns: createTableColumns(declared, tableName),
      });
      continue;
    }
    const desired = desiredColumns(declared, tableName);
    for (const [colName, col] of desired) {
      if (findColumn(existing, colName)) continue;
      ops.push({
        kind: 'add_column',
        table: asSchemaIdent(tableName),
        column: asSchemaIdent(colName),
        type: col.type,
        ...(col.physicalPostgres !== undefined
          ? { physicalPostgres: col.physicalPostgres }
          : {}),
      });
      const expr = resolveBackfillSql(col, 'postgres');
      if (expr !== null) {
        ops.push({
          kind: 'backfill',
          table: asSchemaIdent(tableName),
          column: asSchemaIdent(colName),
          expression: expr,
        });
      }
    }
    for (const retired of retiredColumnsOf(declared, tableName)) {
      if (findColumn(existing, retired.name)) continue;
      ops.push({
        kind: 'add_column',
        table: asSchemaIdent(tableName),
        column: asSchemaIdent(retired.name),
        type: retired.type,
      });
    }
  }
  return ops;
}

const DROP_DEFAULT_COLUMNS: ReadonlySet<string> = new Set([
  'id',
  'created_at',
  'updated_at',
]);

function planRepairs(
  classified: ClassifiedDelta,
  declared: ReadonlyDeclaredSchema,
  catalog: IntrospectedCatalog
): ServerOperation[] {
  const ops: ServerOperation[] = [];
  for (const delta of classified.columnDeltas) {
    if (delta.kind !== 'repair') continue;
    const table = asSchemaIdent(delta.table);
    const column = asSchemaIdent(delta.column);
    if (delta.reason === 'widen integer') {
      ops.push({ kind: 'widen_integer', table, column });
      continue;
    }
    if (delta.reason === 'drop not null') {
      ops.push({ kind: 'drop_not_null', table, column });
    }
  }
  for (const tableName of Object.keys(declared.tables)) {
    const existing = catalog.tables.get(tableName);
    if (!existing) continue;
    for (const col of existing.columns) {
      if (!DROP_DEFAULT_COLUMNS.has(col.name)) continue;
      if (col.columnDefault == null || col.columnDefault === '') continue;
      ops.push({
        kind: 'drop_default',
        table: asSchemaIdent(tableName),
        column: asSchemaIdent(col.name),
      });
    }
  }
  return ops;
}

export function planServer(
  declared: ReadonlyDeclaredSchema,
  catalog: IntrospectedCatalog,
  options?: PlanServerOptions
): PlanServerResult {
  const classified = classifyDelta({
    declared,
    catalog,
    caps: POSTGRES_CAPS,
    mode: 'postgres',
  });
  if (classified.drift.length > 0) {
    return { ok: false, drift: classified.drift };
  }
  const which = options?.operations ?? 'all';
  const tableOps =
    which === 'index'
      ? []
      : [
          ...planRepairs(classified, declared, catalog),
          ...planColumnAdds(declared, catalog),
        ];
  const operations: ServerOperation[] = [
    ...tableOps,
    ...(which === 'table' ? [] : planIndexOperations(declared, catalog)),
  ];
  return { ok: true, operations };
}
