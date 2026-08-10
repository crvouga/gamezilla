import {
  asPackageIndexName,
  asValidatedIdent,
  fingerprintForIndexDef,
} from './index-fingerprint';
import type {
  ClientOperation,
  CreateTableColumn,
  PlanServerResult,
  ServerOperation,
} from './operations';
import { sqlitePhysicalOf } from './type-map';
import type {
  ColumnType,
  DriftError,
  IndexDef,
  IntrospectedCatalog,
  IntrospectedColumn,
  IntrospectedTable,
  ReadonlyDeclaredSchema,
} from './types';
import {
  MANAGED_IMPLICIT_COLUMN_NAMES,
  MANAGED_IMPLICIT_COLUMNS,
  MANAGED_IMPLICIT_SET,
} from './types';

function desiredColumns(
  declared: ReadonlyDeclaredSchema,
  table: string
): Map<string, ColumnType> {
  const cols = new Map<string, ColumnType>();
  for (const [name, type] of Object.entries(MANAGED_IMPLICIT_COLUMNS)) {
    cols.set(name, type);
  }
  for (const [name, type] of Object.entries(declared.tables[table]!)) {
    cols.set(name, type);
  }
  return cols;
}

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
  for (const [name, type] of Object.entries(declared.tables[table]!)) {
    columns.push({
      name: asValidatedIdent(name),
      type,
      isPrimaryKey: false,
    });
  }
  return columns;
}

function isInvisibleUnderscore(name: string): boolean {
  return name.startsWith('_') && !MANAGED_IMPLICIT_SET.has(name);
}

function columnVisibleForDrift(name: string): boolean {
  return !isInvisibleUnderscore(name);
}

function findColumn(
  table: IntrospectedTable,
  name: string
): IntrospectedColumn | undefined {
  return table.columns.find((c) => c.name === name);
}

function logicalTypeMatch(
  expected: ColumnType,
  actual: string,
  mode: 'postgres' | 'sqlite'
): boolean {
  if (mode === 'sqlite') {
    return sqlitePhysicalOf(expected) === actual.toUpperCase();
  }
  return expected === actual;
}

function nullabilityOk(col: IntrospectedColumn): boolean {
  if (col.isPrimaryKey || col.name === 'id') {
    return !col.nullable;
  }
  return col.nullable;
}

function driftExtraColumns(
  tableName: string,
  existing: IntrospectedTable,
  desired: Map<string, ColumnType>
): DriftError[] {
  const drift: DriftError[] = [];
  for (const col of existing.columns) {
    if (!columnVisibleForDrift(col.name)) continue;
    if (!desired.has(col.name)) {
      drift.push({
        path: `${tableName}.${col.name}`,
        message: `re-add the column and add a [${tableName}, ${col.name}, note] deprecation entry`,
      });
      continue;
    }
    const expected = desired.get(col.name)!;
    if (!logicalTypeMatch(expected, col.type, 'postgres')) {
      drift.push({
        path: `${tableName}.${col.name}`,
        message: `column type mismatch: expected '${expected}', found '${col.type}'`,
      });
    }
    if (!nullabilityOk(col)) {
      drift.push({
        path: `${tableName}.${col.name}`,
        message: `column nullability mismatch (non-PK columns must be nullable; id must be NOT NULL)`,
      });
    }
  }
  return drift;
}

function driftMissingDeprecatedColumns(
  declared: ReadonlyDeclaredSchema,
  tableName: string,
  existing: IntrospectedTable
): DriftError[] {
  const drift: DriftError[] = [];
  for (const colName of Object.keys(declared.tables[tableName]!)) {
    if (!declared.deprecatedColumns.has(`${tableName}.${colName}`)) continue;
    if (!findColumn(existing, colName)) {
      drift.push({
        path: `${tableName}.${colName}`,
        message: `deprecated column is missing from the database (deprecation never means "may not exist")`,
      });
    }
  }
  return drift;
}

function driftMissingDeprecatedTables(
  declared: ReadonlyDeclaredSchema,
  catalog: IntrospectedCatalog
): DriftError[] {
  const anyDeclaredPresent = Object.keys(declared.tables).some((t) =>
    catalog.tables.has(t)
  );
  if (!anyDeclaredPresent) return [];
  const drift: DriftError[] = [];
  for (const tableName of declared.deprecatedTables) {
    if (!catalog.tables.has(tableName)) {
      drift.push({
        path: tableName,
        message: `deprecated table is missing from the database (deprecation never means "may not exist")`,
      });
    }
  }
  return drift;
}

function collectServerDrift(
  declared: ReadonlyDeclaredSchema,
  catalog: IntrospectedCatalog
): DriftError[] {
  const drift: DriftError[] = [];
  for (const tableName of Object.keys(declared.tables)) {
    const existing = catalog.tables.get(tableName);
    if (!existing) continue;
    const desired = desiredColumns(declared, tableName);
    drift.push(...driftExtraColumns(tableName, existing, desired));
    drift.push(...driftMissingDeprecatedColumns(declared, tableName, existing));
  }
  drift.push(...driftMissingDeprecatedTables(declared, catalog));
  return drift;
}

function planIndexOps(
  declared: ReadonlyDeclaredSchema,
  catalog: IntrospectedCatalog
): ServerOperation[] {
  const ops: ServerOperation[] = [];
  const desiredIndexNames = new Set<string>();

  const pushCreate = (def: IndexDef, unique: boolean): void => {
    const name = fingerprintForIndexDef(def, unique);
    desiredIndexNames.add(name);
    if (catalog.indexes.some((ix) => ix.name === name)) return;
    const [table, ...columns] = def;
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

function planAdditive(
  declared: ReadonlyDeclaredSchema,
  catalog: IntrospectedCatalog
): ServerOperation[] {
  const ops: ServerOperation[] = [];
  for (const tableName of Object.keys(declared.tables)) {
    const existing = catalog.tables.get(tableName);
    if (!existing) {
      ops.push({
        kind: 'create_table',
        table: asValidatedIdent(tableName),
        columns: createTableColumns(declared, tableName),
      });
      continue;
    }
    const desired = desiredColumns(declared, tableName);
    for (const [colName, type] of desired) {
      if (findColumn(existing, colName)) continue;
      ops.push({
        kind: 'add_column',
        table: asValidatedIdent(tableName),
        column: asValidatedIdent(colName),
        type,
      });
    }
  }
  ops.push(...planIndexOps(declared, catalog));
  return ops;
}

export function planServer(
  declared: ReadonlyDeclaredSchema,
  catalog: IntrospectedCatalog
): PlanServerResult {
  const drift = collectServerDrift(declared, catalog);
  if (drift.length > 0) {
    return { ok: false, drift };
  }
  return { ok: true, operations: planAdditive(declared, catalog) };
}

function needsRebuild(
  existing: IntrospectedTable,
  desired: Map<string, ColumnType>
): boolean {
  for (const col of existing.columns) {
    if (!columnVisibleForDrift(col.name)) continue;
    const expected = desired.get(col.name);
    if (expected === undefined) continue;
    if (!logicalTypeMatch(expected, col.type, 'sqlite')) return true;
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
    if (isInvisibleUnderscore(col.name)) {
      names.push(col.name);
      types[col.name] = col.type;
    }
  }
  return { names, types };
}

function planClientDropUnknownTables(
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

function planClientTableOps(
  declared: ReadonlyDeclaredSchema,
  catalog: IntrospectedCatalog
): ClientOperation[] {
  const ops: ClientOperation[] = [];
  for (const tableName of Object.keys(declared.tables)) {
    const existing = catalog.tables.get(tableName);
    const desired = desiredColumns(declared, tableName);
    if (!existing) {
      ops.push({
        kind: 'create_table',
        table: asValidatedIdent(tableName),
        columns: createTableColumns(declared, tableName),
      });
      continue;
    }
    const extras = underscoreExtras(existing);
    const unknownUserCols = existing.columns.filter(
      (c) => columnVisibleForDrift(c.name) && !desired.has(c.name)
    );
    if (needsRebuild(existing, desired) || unknownUserCols.length > 0) {
      const copyColumns = [...desired.keys(), ...extras.names].filter((n) =>
        findColumn(existing, n)
      );
      ops.push({
        kind: 'rebuild_table',
        table: asValidatedIdent(tableName),
        preserveUnderscoreExtras: extras.names.map(asValidatedIdent),
        preserveExtraTypes: extras.types,
        copyColumns: copyColumns.map(asValidatedIdent),
      });
      continue;
    }
    for (const [colName, type] of desired) {
      if (findColumn(existing, colName)) continue;
      ops.push({
        kind: 'add_column',
        table: asValidatedIdent(tableName),
        column: asValidatedIdent(colName),
        type,
      });
    }
  }
  return ops;
}

function planClientIndexOps(
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

const CLIENT_OP_ORDER: Record<ClientOperation['kind'], number> = {
  drop_table: 0,
  drop_column: 1,
  rebuild_table: 2,
  create_table: 3,
  add_column: 4,
  drop_index: 5,
  create_index: 6,
};

export type PlanClientOptions = {
  readonly ownership?: 'whole-db' | 'declared-only';
};

export function planClient(
  declared: ReadonlyDeclaredSchema,
  catalog: IntrospectedCatalog,
  options?: PlanClientOptions
): ClientOperation[] {
  const ownership = options?.ownership ?? 'whole-db';
  const declaredNames = new Set(Object.keys(declared.tables));
  const ops: ClientOperation[] = [
    ...planClientDropUnknownTables(declaredNames, catalog, ownership),
    ...planClientTableOps(declared, catalog),
  ];
  ops.push(...planClientIndexOps(declared, catalog, declaredNames, ops));
  ops.sort((a, b) => CLIENT_OP_ORDER[a.kind] - CLIENT_OP_ORDER[b.kind]);
  return ops;
}
