import type { DialectCaps } from './dialect-caps';
import { sqlitePhysicalOf } from './type-map';
import type {
  ColumnType,
  DeclaredColumn,
  DriftError,
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

export type DeltaKind = 'additive' | 'expand' | 'contract_client' | 'forbidden';

export type ClassifiedColumnDelta = {
  readonly table: string;
  readonly column: string;
  readonly kind: DeltaKind;
  readonly reason: string;
  readonly declared?: DeclaredColumn;
  readonly existing?: IntrospectedColumn;
};

export type ClassifiedDelta = {
  readonly drift: readonly DriftError[];
  readonly columnDeltas: readonly ClassifiedColumnDelta[];
  readonly deprecatedExtras: readonly {
    readonly table: string;
    readonly column: string;
  }[];
  readonly forbiddenExtras: readonly {
    readonly table: string;
    readonly column: string;
  }[];
};

type MutableClassified = {
  drift: DriftError[];
  columnDeltas: ClassifiedColumnDelta[];
  deprecatedExtras: { table: string; column: string }[];
  forbiddenExtras: { table: string; column: string }[];
};

function isInvisibleUnderscore(name: string): boolean {
  return name.startsWith('_') && !MANAGED_IMPLICIT_SET.has(name);
}

export function columnVisibleForDrift(name: string): boolean {
  return !isInvisibleUnderscore(name);
}

export function desiredColumns(
  declared: ReadonlyDeclaredSchema,
  table: string
): Map<string, DeclaredColumn> {
  const cols = new Map<string, DeclaredColumn>();
  for (const name of MANAGED_IMPLICIT_COLUMN_NAMES) {
    cols.set(name, { type: MANAGED_IMPLICIT_COLUMNS[name] });
  }
  for (const [name, col] of Object.entries(declared.tables[table]!)) {
    cols.set(name, col);
  }
  return cols;
}

export function findColumn(
  table: IntrospectedTable,
  name: string
): IntrospectedColumn | undefined {
  return table.columns.find((c) => c.name === name);
}

export function logicalTypeMatch(
  expected: ColumnType,
  actual: string,
  mode: 'postgres' | 'sqlite',
  declared?: DeclaredColumn
): boolean {
  if (mode === 'sqlite') {
    if (declared?.physicalSqlite !== undefined) {
      return declared.physicalSqlite.toUpperCase() === actual.toUpperCase();
    }
    return sqlitePhysicalOf(expected) === actual.toUpperCase();
  }
  if (declared?.physicalPostgres !== undefined) {
    return declared.physicalPostgres.toLowerCase() === actual.toLowerCase();
  }
  return expected === actual;
}

export function nullabilityOk(col: IntrospectedColumn): boolean {
  if (col.isPrimaryKey || col.name === 'id') {
    return !col.nullable;
  }
  return col.nullable;
}

function hasLifecycleSource(col: DeclaredColumn): boolean {
  return (
    col.renamedFrom !== undefined ||
    col.widenedFrom !== undefined ||
    col.backfill !== undefined
  );
}

function classifyExtraColumn(args: {
  tableName: string;
  col: IntrospectedColumn;
  declared: ReadonlyDeclaredSchema;
  caps: DialectCaps;
  out: MutableClassified;
}): void {
  const { tableName, col, declared, caps, out } = args;
  if (declared.deprecatedColumns.has(`${tableName}.${col.name}`)) {
    out.deprecatedExtras.push({ table: tableName, column: col.name });
    if (!caps.dropDeprecated) return;
    out.columnDeltas.push({
      table: tableName,
      column: col.name,
      kind: 'contract_client',
      reason: 'deprecated column may be dropped on client',
      existing: col,
    });
    return;
  }
  out.forbiddenExtras.push({ table: tableName, column: col.name });
  out.drift.push({
    path: `${tableName}.${col.name}`,
    message: `add a [${tableName}, ${col.name}, note] deprecation entry`,
  });
  out.columnDeltas.push({
    table: tableName,
    column: col.name,
    kind: 'forbidden',
    reason: 'extra column without deprecation',
    existing: col,
  });
}

function classifyTypeMismatch(args: {
  tableName: string;
  col: IntrospectedColumn;
  expected: DeclaredColumn;
  caps: DialectCaps;
  out: MutableClassified;
}): void {
  const { tableName, col, expected, out } = args;
  void args.caps;
  const hint = hasLifecycleSource(expected)
    ? ` (use a new column + widenedFrom/renamedFrom + deprecate the old one; never ALTER TYPE)`
    : '';
  out.drift.push({
    path: `${tableName}.${col.name}`,
    message: `column type mismatch: expected '${expected.type}', found '${col.type}'${hint}`,
  });
  out.columnDeltas.push({
    table: tableName,
    column: col.name,
    kind: 'forbidden',
    reason: hasLifecycleSource(expected)
      ? 'in-place type change'
      : 'type mismatch',
    declared: expected,
    existing: col,
  });
}

function classifyNullability(args: {
  tableName: string;
  col: IntrospectedColumn;
  expected: DeclaredColumn;
  caps: DialectCaps;
  out: MutableClassified;
}): void {
  const { tableName, col, expected, out } = args;
  void args.caps;
  out.drift.push({
    path: `${tableName}.${col.name}`,
    message: `column nullability mismatch (non-PK columns must be nullable; id must be NOT NULL)`,
  });
  out.columnDeltas.push({
    table: tableName,
    column: col.name,
    kind: 'forbidden',
    reason: 'nullability mismatch',
    declared: expected,
    existing: col,
  });
}

function classifyExistingColumns(args: {
  tableName: string;
  existing: IntrospectedTable;
  desired: Map<string, DeclaredColumn>;
  declared: ReadonlyDeclaredSchema;
  caps: DialectCaps;
  mode: 'postgres' | 'sqlite';
  out: MutableClassified;
}): void {
  const { tableName, existing, desired, declared, caps, mode, out } = args;
  for (const col of existing.columns) {
    if (!columnVisibleForDrift(col.name)) continue;
    if (!desired.has(col.name)) {
      classifyExtraColumn({ tableName, col, declared, caps, out });
      continue;
    }
    const expected = desired.get(col.name)!;
    if (!logicalTypeMatch(expected.type, col.type, mode, expected)) {
      classifyTypeMismatch({ tableName, col, expected, caps, out });
    }
    if (!nullabilityOk(col)) {
      classifyNullability({ tableName, col, expected, caps, out });
    }
  }
}

function classifyMissingColumns(args: {
  tableName: string;
  existing: IntrospectedTable;
  desired: Map<string, DeclaredColumn>;
  out: MutableClassified;
}): void {
  const { tableName, existing, desired, out } = args;
  for (const [colName, declaredCol] of desired) {
    if (findColumn(existing, colName)) continue;
    const kind: DeltaKind = hasLifecycleSource(declaredCol)
      ? 'expand'
      : 'additive';
    out.columnDeltas.push({
      table: tableName,
      column: colName,
      kind,
      reason:
        kind === 'expand'
          ? 'new column with lifecycle (rename/backfill/widen)'
          : 'new column',
      declared: declaredCol,
    });
  }
}

function classifyMissingDeprecated(args: {
  declared: ReadonlyDeclaredSchema;
  catalog: IntrospectedCatalog;
  caps: DialectCaps;
  out: MutableClassified;
}): void {
  const { declared, catalog, caps, out } = args;
  if (caps.dropDeprecated) return;
  const anyDeclaredPresent = Object.keys(declared.tables).some((t) =>
    catalog.tables.has(t)
  );
  if (!anyDeclaredPresent) return;
  for (const tableName of declared.deprecatedTables) {
    if (!catalog.tables.has(tableName)) {
      out.drift.push({
        path: tableName,
        message: `deprecated table is missing from the database (deprecation never means "may not exist")`,
      });
    }
  }
  for (const viewName of declared.deprecatedViews) {
    if (!(catalog.views ?? []).some((v) => v.name === viewName)) {
      out.drift.push({
        path: viewName,
        message: `deprecated view is missing from the database`,
      });
    }
  }
}

/**
 * Pure compatibility classifier. Planners turn this into dialect operations
 * using {@link DialectCaps}; they never invent safety rules themselves.
 */
export function classifyDelta(args: {
  readonly declared: ReadonlyDeclaredSchema;
  readonly catalog: IntrospectedCatalog;
  readonly caps: DialectCaps;
  readonly mode: 'postgres' | 'sqlite';
}): ClassifiedDelta {
  const { declared, catalog, caps, mode } = args;
  const out: MutableClassified = {
    drift: [],
    columnDeltas: [],
    deprecatedExtras: [],
    forbiddenExtras: [],
  };
  for (const tableName of Object.keys(declared.tables)) {
    const existing = catalog.tables.get(tableName);
    if (!existing) continue;
    const desired = desiredColumns(declared, tableName);
    classifyExistingColumns({
      tableName,
      existing,
      desired,
      declared,
      caps,
      mode,
      out,
    });
    classifyMissingColumns({ tableName, existing, desired, out });
  }
  classifyMissingDeprecated({ declared, catalog, caps, out });
  return out;
}
