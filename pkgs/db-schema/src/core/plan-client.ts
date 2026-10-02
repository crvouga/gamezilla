import { resolveBackfillSql } from './backfill';
import { classifyDelta, desiredColumns, findColumn } from './compatibility';
import { SQLITE_CAPS } from './dialect-caps';
import {
  asPackageIndexName,
  asPhysicalIdent,
  asSchemaIdent,
  fingerprintForIndexDef,
} from './index-fingerprint';
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
  PhysicalIdent,
  ReadonlyDeclaredSchema,
  SchemaIdent,
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
  };
}

/** Physical SQLite type to re-declare for a preserved extra column. */
function sqliteExtraType(physical: string): string {
  const upper = physical.toUpperCase();
  if (upper === 'INTEGER' || upper === 'REAL' || upper === 'BLOB') {
    return upper;
  }
  return 'TEXT';
}

/**
 * Undeclared columns to preserve verbatim across a rebuild. The client is a
 * cache: an unknown column means a newer bundle wrote here, or a stale bundle
 * is running — never a reason to fail boot or drop data.
 */
function extras(
  existing: IntrospectedTable,
  desired: Map<string, DeclaredColumn>,
  retired: ReadonlySet<string>
): Record<string, string> {
  const preserved: Record<string, string> = {};
  for (const col of existing.columns) {
    if (desired.has(col.name) || retired.has(col.name)) continue;
    preserved[col.name] = sqliteExtraType(col.physical);
  }
  return preserved;
}

function retiredColumnNames(
  declared: ReadonlyDeclaredSchema,
  tableName: string
): Set<string> {
  const names = new Set<string>();
  for (const [key, entry] of declared.retiredColumns) {
    if (key.slice(0, key.lastIndexOf('.')) === tableName) {
      names.add(entry.name);
    }
  }
  return names;
}

function columnCopyRef(name: string): SchemaIdent | PhysicalIdent {
  if (!MANAGED_IMPLICIT_SET.has(name)) {
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
  catalog: IntrospectedCatalog
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
  const retired = retiredColumnNames(declared, tableName);
  const preserved = extras(existing, desired, retired);
  const retiredPresent = existing.columns.some((c) => retired.has(c.name));
  const copyAliases = collectCopyAliases(desired, existing);
  const needsShapeRebuild =
    retiredPresent || Object.keys(copyAliases).length > 0;

  if (needsShapeRebuild) {
    const copyColumns = [...desired.keys(), ...Object.keys(preserved)].filter(
      (n) => findColumn(existing, n) || copyAliases[n] !== undefined
    );
    const backfills = collectRebuildBackfills(desired, existing, copyAliases);
    return [
      {
        kind: 'rebuild_table',
        table: asSchemaIdent(tableName),
        preserveExtras: preserved,
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
  catalog: IntrospectedCatalog
): ClientOperation[] {
  const ops: ClientOperation[] = [];
  for (const tableName of Object.keys(declared.tables)) {
    ops.push(...planOneTable(tableName, declared, catalog));
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
    if (!declaredNames.has(ix.table)) continue;
    const branded = asPackageIndexName(ix.name);
    if (!branded || desiredIndexNames.has(branded)) continue;
    ops.push({ kind: 'drop_index', name: branded });
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
  rebuild_table: 1,
  create_table: 2,
  drop_not_null: 3,
  widen_integer: 4,
  drop_default: 5,
  add_column: 6,
  backfill: 7,
  drop_index: 8,
  create_index: 9,
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
  const tableOps = planTableOps(declared, catalog);
  const ops: ClientOperation[] = [
    ...planDropUnknownTables(declaredNames, catalog, ownership),
    ...tableOps,
  ];
  ops.push(...planIndexOps(declared, catalog, declaredNames, ops));
  ops.push(...planRebuildBackfillOps(tableOps));
  ops.sort((a, b) => CLIENT_OP_ORDER[a.kind] - CLIENT_OP_ORDER[b.kind]);
  return { ok: true, operations: ops };
}
