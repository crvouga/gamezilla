import {
  classifyDelta,
  columnVisibleForDrift,
  desiredColumns,
  findColumn,
  logicalTypeMatch,
} from './compatibility';
import { SQLITE_CAPS } from './dialect-caps';
import {
  asPackageIndexName,
  asValidatedIdent,
  fingerprintForIndexDef,
} from './index-fingerprint';
import { resolveBackfillSql } from './lifecycle';
import type {
  ClientOperation,
  CreateTableColumn,
  PlanClientResult,
} from './operations';
import type {
  DeclaredColumn,
  IndexDef,
  IntrospectedCatalog,
  IntrospectedTable,
  ReadonlyDeclaredSchema,
} from './types';
import {
  MANAGED_IMPLICIT_COLUMN_NAMES,
  MANAGED_IMPLICIT_COLUMNS,
  MANAGED_IMPLICIT_SET,
} from './types';

export type PlanClientOptions = {
  readonly ownership?: 'whole-db' | 'declared-only';
};

function createTableColumns(
  declared: ReadonlyDeclaredSchema,
  table: string
): CreateTableColumn[] {
  const columns: CreateTableColumn[] = [];
  for (const name of MANAGED_IMPLICIT_COLUMN_NAMES) {
    columns.push({
      name: asValidatedIdent(name),
      type: MANAGED_IMPLICIT_COLUMNS[name],
      isPrimaryKey: name === 'id',
    });
  }
  for (const [name, col] of Object.entries(declared.tables[table]!)) {
    columns.push(toCreateColumn(name, col));
  }
  return columns;
}

function toCreateColumn(name: string, col: DeclaredColumn): CreateTableColumn {
  return {
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
  };
}

function needsRebuild(
  existing: IntrospectedTable,
  desired: Map<string, DeclaredColumn>
): boolean {
  for (const col of existing.columns) {
    if (!columnVisibleForDrift(col.name)) continue;
    const expected = desired.get(col.name);
    if (expected === undefined) continue;
    if (!logicalTypeMatch(expected.type, col.type, 'sqlite', expected)) {
      return true;
    }
    if (col.name === 'id' && col.nullable) return true;
    if (col.name !== 'id' && !col.nullable && desired.has(col.name)) {
      return true;
    }
  }
  return false;
}

function underscoreExtras(existing: IntrospectedTable): {
  names: string[];
  types: Record<string, string>;
} {
  const names: string[] = [];
  const types: Record<string, string> = {};
  for (const col of existing.columns) {
    if (col.name.startsWith('_') && !MANAGED_IMPLICIT_SET.has(col.name)) {
      names.push(col.name);
      types[col.name] = col.type;
    }
  }
  return { names, types };
}

function planDropUnknownTables(
  declaredNames: Set<string>,
  catalog: IntrospectedCatalog,
  ownership: 'whole-db' | 'declared-only'
): ClientOperation[] {
  if (ownership === 'declared-only') return [];
  const ops: ClientOperation[] = [];
  for (const name of catalog.allTableNames) {
    if (declaredNames.has(name) || name.startsWith('sqlite_')) continue;
    ops.push({ kind: 'drop_table', table: asValidatedIdent(name) });
  }
  return ops;
}

function collectCopyAliases(
  desired: Map<string, DeclaredColumn>,
  existing: IntrospectedTable
): Record<string, string> {
  const copyAliases: Record<string, string> = {};
  for (const [colName, col] of desired) {
    if (
      col.renamedFrom !== undefined &&
      findColumn(existing, col.renamedFrom)
    ) {
      copyAliases[colName] = col.renamedFrom;
    } else if (
      col.widenedFrom !== undefined &&
      findColumn(existing, col.widenedFrom)
    ) {
      copyAliases[colName] = col.widenedFrom;
    }
  }
  return copyAliases;
}

function planAdditiveColumns(
  tableName: string,
  desired: Map<string, DeclaredColumn>,
  existing: IntrospectedTable
): ClientOperation[] {
  const ops: ClientOperation[] = [];
  for (const [colName, col] of desired) {
    if (findColumn(existing, colName)) continue;
    ops.push({
      kind: 'add_column',
      table: asValidatedIdent(tableName),
      column: asValidatedIdent(colName),
      type: col.type,
      ...(col.physicalSqlite !== undefined
        ? { physicalSqlite: col.physicalSqlite }
        : {}),
    });
    const expr = resolveBackfillSql(col, 'sqlite');
    if (expr !== null) {
      ops.push({
        kind: 'backfill',
        table: asValidatedIdent(tableName),
        column: asValidatedIdent(colName),
        expression: expr,
      });
    }
  }
  return ops;
}

function planOneTable(
  tableName: string,
  declared: ReadonlyDeclaredSchema,
  catalog: IntrospectedCatalog,
  depCols: Set<string>
): ClientOperation[] {
  const existing = catalog.tables.get(tableName);
  const desired = desiredColumns(declared, tableName);
  if (!existing) {
    return [
      {
        kind: 'create_table',
        table: asValidatedIdent(tableName),
        columns: createTableColumns(declared, tableName),
      },
    ];
  }
  const extras = underscoreExtras(existing);
  const hasDeprecatedExtras = existing.columns.some(
    (c) => columnVisibleForDrift(c.name) && depCols.has(c.name)
  );
  const copyAliases = collectCopyAliases(desired, existing);
  if (
    needsRebuild(existing, desired) ||
    hasDeprecatedExtras ||
    Object.keys(copyAliases).length > 0
  ) {
    const copyColumns = [...desired.keys(), ...extras.names].filter(
      (n) => findColumn(existing, n) || copyAliases[n] !== undefined
    );
    return [
      {
        kind: 'rebuild_table',
        table: asValidatedIdent(tableName),
        preserveUnderscoreExtras: extras.names.map(asValidatedIdent),
        preserveExtraTypes: extras.types,
        copyColumns: copyColumns.map(asValidatedIdent),
        ...(Object.keys(copyAliases).length > 0 ? { copyAliases } : {}),
      },
    ];
  }
  return planAdditiveColumns(tableName, desired, existing);
}

function planTableOps(
  declared: ReadonlyDeclaredSchema,
  catalog: IntrospectedCatalog,
  deprecatedExtras: readonly { table: string; column: string }[]
): ClientOperation[] {
  const ops: ClientOperation[] = [];
  const deprecatedByTable = new Map<string, Set<string>>();
  for (const e of deprecatedExtras) {
    const set = deprecatedByTable.get(e.table) ?? new Set();
    set.add(e.column);
    deprecatedByTable.set(e.table, set);
  }
  for (const tableName of Object.keys(declared.tables)) {
    ops.push(
      ...planOneTable(
        tableName,
        declared,
        catalog,
        deprecatedByTable.get(tableName) ?? new Set()
      )
    );
  }
  return ops;
}

function planIndexOps(
  declared: ReadonlyDeclaredSchema,
  catalog: IntrospectedCatalog,
  declaredNames: Set<string>,
  priorOps: readonly ClientOperation[]
): ClientOperation[] {
  const ops: ClientOperation[] = [];
  const desiredIndexNames = new Set<string>();

  const pushCreate = (def: IndexDef, unique: boolean): void => {
    const name = fingerprintForIndexDef(def, unique);
    desiredIndexNames.add(name);
    if (catalog.indexes.some((ix) => ix.name === name)) return;
    const [table, ...columns] = def;
    if (
      !declaredNames.has(table) ||
      priorOps.some((o) => o.kind === 'drop_table' && o.table === table)
    ) {
      return;
    }
    ops.push({
      kind: 'create_index',
      name,
      table: asValidatedIdent(table),
      columns: columns.map(asValidatedIdent),
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
    if (!branded || desiredIndexNames.has(branded)) continue;
    ops.push({ kind: 'drop_index', name: branded });
  }
  return ops;
}

function planViewOps(
  declared: ReadonlyDeclaredSchema,
  catalog: IntrospectedCatalog
): ClientOperation[] {
  const ops: ClientOperation[] = [];
  const existingViews = new Set((catalog.views ?? []).map((v) => v.name));
  for (const view of declared.views) {
    if (declared.deprecatedViews.has(view.name)) {
      if (existingViews.has(view.name)) {
        ops.push({ kind: 'drop_view', name: asValidatedIdent(view.name) });
      }
      continue;
    }
    const expr =
      typeof view.sql === 'string'
        ? view.sql
        : (view.sql.sqlite ?? view.sql.sql);
    ops.push({
      kind: existingViews.has(view.name) ? 'replace_view' : 'create_view',
      name: asValidatedIdent(view.name),
      expression: expr,
    });
  }
  return ops;
}

const CLIENT_OP_ORDER: Record<ClientOperation['kind'], number> = {
  drop_table: 0,
  drop_view: 1,
  drop_column: 2,
  rebuild_table: 3,
  create_table: 4,
  add_column: 5,
  backfill: 6,
  drop_index: 7,
  create_index: 8,
  add_check: 9,
  add_foreign_key: 10,
  create_view: 11,
  replace_view: 12,
  create_enum: 13,
  add_enum_value: 14,
};

export function planClient(
  declared: ReadonlyDeclaredSchema,
  catalog: IntrospectedCatalog,
  options?: PlanClientOptions
): PlanClientResult {
  const ownership = options?.ownership ?? 'whole-db';
  const classified = classifyDelta({
    declared,
    catalog,
    caps: SQLITE_CAPS,
    mode: 'sqlite',
  });
  if (classified.drift.length > 0) {
    return { ok: false, drift: classified.drift };
  }

  const declaredNames = new Set(Object.keys(declared.tables));
  const ops: ClientOperation[] = [
    ...planDropUnknownTables(declaredNames, catalog, ownership),
    ...planTableOps(declared, catalog, classified.deprecatedExtras),
    ...planViewOps(declared, catalog),
  ];
  ops.push(...planIndexOps(declared, catalog, declaredNames, ops));
  ops.sort((a, b) => CLIENT_OP_ORDER[a.kind] - CLIENT_OP_ORDER[b.kind]);
  return { ok: true, operations: ops };
}
