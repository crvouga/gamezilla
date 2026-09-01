import {
  classifyDelta,
  columnVisibleForDrift,
  desiredColumns,
  findColumn,
} from './compatibility';
import { SQLITE_CAPS } from './dialect-caps';
import {
  asPackageIndexName,
  asPhysicalIdent,
  asSchemaIdent,
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
      name: asSchemaIdent(name),
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
  };
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

function missingChecksOrFks(
  tableName: string,
  declared: ReadonlyDeclaredSchema,
  catalog: IntrospectedCatalog
): boolean {
  const existingChecks = new Set(
    (catalog.checks ?? []).map((c) => `${c.table}.${c.name}`)
  );
  for (const check of declared.checks) {
    if (
      check.table === tableName &&
      !existingChecks.has(`${check.table}.${check.name}`)
    ) {
      return true;
    }
  }
  const existingFks = new Set(
    (catalog.foreignKeys ?? []).map((f) => `${f.table}.${f.column}`)
  );
  for (const [colName, col] of Object.entries(declared.tables[tableName]!)) {
    if (
      col.references !== undefined &&
      !existingFks.has(`${tableName}.${colName}`)
    ) {
      return true;
    }
  }
  return false;
}

function columnCopyRef(
  name: string
): import('./types').SchemaIdent | import('./types').PhysicalIdent {
  if (name.startsWith('_') && !MANAGED_IMPLICIT_SET.has(name)) {
    return asPhysicalIdent(name);
  }
  return asSchemaIdent(name);
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
    ops.push({ kind: 'drop_table', table: asSchemaIdent(name) });
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

function collectRebuildBackfills(
  desired: Map<string, DeclaredColumn>,
  existing: IntrospectedTable,
  copyAliases: Record<string, string>
): Record<string, string> {
  const backfills: Record<string, string> = {};
  for (const [colName, col] of desired) {
    if (findColumn(existing, colName)) continue;
    if (copyAliases[colName] !== undefined) continue;
    const expr = resolveBackfillSql(col, 'sqlite');
    if (expr !== null) {
      backfills[colName] = expr;
    }
  }
  return backfills;
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
      table: asSchemaIdent(tableName),
      column: asSchemaIdent(colName),
      type: col.type,
      ...(col.physicalSqlite !== undefined
        ? { physicalSqlite: col.physicalSqlite }
        : {}),
    });
    const expr = resolveBackfillSql(col, 'sqlite');
    if (expr !== null) {
      ops.push({
        kind: 'backfill',
        table: asSchemaIdent(tableName),
        column: asSchemaIdent(colName),
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
        table: asSchemaIdent(tableName),
        columns: createTableColumns(declared, tableName),
      },
    ];
  }
  const extras = underscoreExtras(existing);
  const hasDeprecatedExtras = existing.columns.some(
    (c) => columnVisibleForDrift(c.name) && depCols.has(c.name)
  );
  const copyAliases = collectCopyAliases(desired, existing);
  const needsShapeRebuild =
    hasDeprecatedExtras ||
    Object.keys(copyAliases).length > 0 ||
    missingChecksOrFks(tableName, declared, catalog);

  if (needsShapeRebuild) {
    const copyColumns = [...desired.keys(), ...extras.names].filter(
      (n) => findColumn(existing, n) || copyAliases[n] !== undefined
    );
    const backfills = collectRebuildBackfills(desired, existing, copyAliases);
    return [
      {
        kind: 'rebuild_table',
        table: asSchemaIdent(tableName),
        preserveUnderscoreExtras: extras.names.map(asPhysicalIdent),
        preserveExtraTypes: extras.types,
        copyColumns: copyColumns.map(columnCopyRef),
        ...(Object.keys(copyAliases).length > 0 ? { copyAliases } : {}),
        ...(Object.keys(backfills).length > 0 ? { backfills } : {}),
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

function tablesNeedingIndexRecreate(
  priorOps: readonly ClientOperation[]
): ReadonlySet<string> {
  const rebuilt = new Set<string>();
  for (const op of priorOps) {
    if (op.kind === 'rebuild_table' || op.kind === 'drop_table') {
      rebuilt.add(op.table);
    }
  }
  return rebuilt;
}

function planIndexOps(
  declared: ReadonlyDeclaredSchema,
  catalog: IntrospectedCatalog,
  declaredNames: Set<string>,
  priorOps: readonly ClientOperation[]
): ClientOperation[] {
  const ops: ClientOperation[] = [];
  const desiredIndexNames = new Set<string>();
  const rebuiltTables = tablesNeedingIndexRecreate(priorOps);

  const pushCreate = (def: IndexDef, unique: boolean): void => {
    const name = fingerprintForIndexDef(def, unique);
    desiredIndexNames.add(name);
    const [table, ...columns] = def;
    if (
      !declaredNames.has(table) ||
      priorOps.some((o) => o.kind === 'drop_table' && o.table === table)
    ) {
      return;
    }
    const indexExists =
      catalog.indexes.some((ix) => ix.name === name) &&
      !rebuiltTables.has(table);
    if (indexExists) return;
    ops.push({
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
        ops.push({ kind: 'drop_view', name: asSchemaIdent(view.name) });
      }
      continue;
    }
    const expr =
      typeof view.sql === 'string'
        ? view.sql
        : (view.sql.sqlite ?? view.sql.sql);
    ops.push({
      kind: existingViews.has(view.name) ? 'replace_view' : 'create_view',
      name: asSchemaIdent(view.name),
      expression: expr,
    });
  }
  return ops;
}

function planRebuildBackfillOps(
  priorOps: readonly ClientOperation[]
): ClientOperation[] {
  const ops: ClientOperation[] = [];
  for (const op of priorOps) {
    if (op.kind !== 'rebuild_table' || op.backfills === undefined) continue;
    for (const [column, expression] of Object.entries(op.backfills)) {
      ops.push({
        kind: 'backfill',
        table: op.table,
        column: asSchemaIdent(column),
        expression,
      });
    }
  }
  return ops;
}

const CLIENT_OP_ORDER: Record<ClientOperation['kind'], number> = {
  drop_table: 0,
  drop_view: 1,
  rebuild_table: 2,
  create_table: 3,
  add_column: 4,
  backfill: 5,
  drop_index: 6,
  create_index: 7,
  add_check: 8,
  add_foreign_key: 9,
  create_view: 10,
  replace_view: 11,
  create_enum: 12,
  add_enum_value: 13,
};

export function planClient(
  declared: ReadonlyDeclaredSchema,
  catalog: IntrospectedCatalog,
  options?: PlanClientOptions
): PlanClientResult {
  const ownership = options?.ownership ?? 'declared-only';
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
  const tableOps = planTableOps(declared, catalog, classified.deprecatedExtras);
  const ops: ClientOperation[] = [
    ...planDropUnknownTables(declaredNames, catalog, ownership),
    ...tableOps,
    ...planViewOps(declared, catalog),
  ];
  ops.push(...planIndexOps(declared, catalog, declaredNames, ops));
  ops.push(...planRebuildBackfillOps(tableOps));
  ops.sort((a, b) => CLIENT_OP_ORDER[a.kind] - CLIENT_OP_ORDER[b.kind]);
  return { ok: true, operations: ops };
}
