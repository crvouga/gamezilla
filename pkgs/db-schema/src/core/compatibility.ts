import type { DialectCaps } from './dialect-caps';
import { normalizePgPhysical, PG_TYPE_SQL, sqlitePhysicalOf } from './type-map';
import type {
  ColumnType,
  DeclaredColumn,
  DriftError,
  IntrospectedCatalog,
  IntrospectedColumn,
  IntrospectedTable,
  ReadonlyDeclaredSchema,
  RetiredColumn,
} from './types';
import {
  MANAGED_IMPLICIT_COLUMN_NAMES,
  MANAGED_IMPLICIT_COLUMNS,
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
  /** Client: undeclared columns preserved verbatim across rebuilds. */
  readonly preservedExtras: readonly {
    readonly table: string;
    readonly column: string;
  }[];
  /** Retired columns still physically present. */
  readonly retiredExtras: readonly {
    readonly table: string;
    readonly column: string;
  }[];
};

type MutableClassified = {
  drift: DriftError[];
  columnDeltas: ClassifiedColumnDelta[];
  preservedExtras: { table: string; column: string }[];
  retiredExtras: { table: string; column: string }[];
};

/**
 * Tombstones for one table, in declaration order.
 */
export function retiredColumnsOf(
  declared: ReadonlyDeclaredSchema,
  tableName: string
): readonly RetiredColumn[] {
  const out: RetiredColumn[] = [];
  for (const [key, entry] of declared.retiredColumns) {
    if (key.slice(0, key.lastIndexOf('.')) === tableName) out.push(entry);
  }
  return out;
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

/**
 * Compare a declared logical type against an introspected physical type for
 * one dialect. `actual` is the engine's physical type name (Postgres
 * `udt_name`, SQLite STRICT affinity).
 */
/**
 * The engine type a declared column is expected to have. Drift compares
 * physical types, so this is also what a mismatch must report: the logical
 * token alone reads as `expected 'integer', found 'integer'` when a declared
 * `integer` (physical `bigint`) meets an `int4` column.
 */
export function expectedPhysicalOf(
  expected: ColumnType,
  mode: 'postgres' | 'sqlite',
  declared?: DeclaredColumn
): string {
  if (mode === 'sqlite') {
    return declared?.physicalSqlite ?? sqlitePhysicalOf(expected);
  }
  return normalizePgPhysical(
    declared?.physicalPostgres ?? pgPhysicalOf(expected)
  );
}

export function logicalTypeMatch(
  expected: ColumnType,
  actual: string,
  mode: 'postgres' | 'sqlite',
  declared?: DeclaredColumn
): boolean {
  const expectedPhysical = expectedPhysicalOf(expected, mode, declared);
  if (mode === 'sqlite') {
    return expectedPhysical.toUpperCase() === actual.toUpperCase();
  }
  return expectedPhysical === normalizePgPhysical(actual);
}

function pgPhysicalOf(token: ColumnType): string {
  return PG_TYPE_SQL[token];
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

function retiredColumnsForTable(
  declared: ReadonlyDeclaredSchema,
  tableName: string
): Map<string, RetiredColumn> {
  const out = new Map<string, RetiredColumn>();
  for (const [key, entry] of declared.retiredColumns) {
    const separator = key.lastIndexOf('.');
    if (key.slice(0, separator) === tableName) {
      out.set(entry.name, entry);
    }
  }
  return out;
}

function classifyRetiredColumn(args: {
  tableName: string;
  col: IntrospectedColumn;
  retired: RetiredColumn;
  caps: DialectCaps;
  mode: 'postgres' | 'sqlite';
  out: MutableClassified;
}): void {
  const { tableName, col, retired, caps, mode, out } = args;
  out.retiredExtras.push({ table: tableName, column: col.name });
  const declared: DeclaredColumn = { type: retired.type };
  if (!logicalTypeMatch(retired.type, col.physical, mode, declared)) {
    const wanted = expectedPhysicalOf(retired.type, mode, declared);
    out.drift.push({
      path: `${tableName}.${col.name}`,
      message: `retired column changed shape: expected '${retired.type}' (${wanted}), found '${String(col.type)}' (${col.physical}) — old clients still read it`,
    });
    out.columnDeltas.push({
      table: tableName,
      column: col.name,
      kind: 'forbidden',
      reason: 'retired column shape changed',
      existing: col,
    });
    return;
  }
  if (!caps.dropRetired) return;
  out.columnDeltas.push({
    table: tableName,
    column: col.name,
    kind: 'contract_client',
    reason: 'retired column may be dropped on the client',
    existing: col,
  });
}

function classifyExtraColumn(args: {
  tableName: string;
  col: IntrospectedColumn;
  declared: ReadonlyDeclaredSchema;
  caps: DialectCaps;
  mode: 'postgres' | 'sqlite';
  out: MutableClassified;
}): void {
  const { tableName, col, declared, caps, mode, out } = args;
  const retired = retiredColumnsForTable(declared, tableName).get(col.name);
  if (retired !== undefined) {
    classifyRetiredColumn({ tableName, col, retired, caps, mode, out });
    return;
  }
  if (caps.dropRetired) {
    // Client: local SQLite is a cache. Undeclared columns are preserved
    // verbatim rather than treated as drift, so a stale bundle never bricks.
    out.preservedExtras.push({ table: tableName, column: col.name });
    return;
  }
  out.drift.push({
    path: `${tableName}.${col.name}`,
    message:
      'column not declared by this build — either this build is older than the database, or the column was removed without a retiredColumns entry',
  });
  out.columnDeltas.push({
    table: tableName,
    column: col.name,
    kind: 'forbidden',
    reason: 'extra column without a retiredColumns tombstone',
    existing: col,
  });
}

function classifyTypeMismatch(args: {
  tableName: string;
  col: IntrospectedColumn;
  expected: DeclaredColumn;
  mode: 'postgres' | 'sqlite';
  out: MutableClassified;
}): void {
  const { tableName, col, expected, mode, out } = args;
  const hint = hasLifecycleSource(expected)
    ? ' (use a new column + widenedFrom/renamedFrom + retire the old one; never ALTER TYPE)'
    : '';
  const wanted = expectedPhysicalOf(expected.type, mode, expected);
  out.drift.push({
    path: `${tableName}.${col.name}`,
    message: `column type mismatch: expected '${expected.type}' (${wanted}), found '${String(col.type)}' (${col.physical})${hint}`,
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
  out: MutableClassified;
}): void {
  const { tableName, col, expected, out } = args;
  out.drift.push({
    path: `${tableName}.${col.name}`,
    message:
      'column nullability mismatch (non-PK columns must be nullable; id must be NOT NULL)',
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
    if (!desired.has(col.name)) {
      classifyExtraColumn({
        tableName,
        col,
        declared,
        caps,
        mode,
        out,
      });
      continue;
    }
    const expected = desired.get(col.name)!;
    if (!logicalTypeMatch(expected.type, col.physical, mode, expected)) {
      classifyTypeMismatch({ tableName, col, expected, mode, out });
    }
    if (!nullabilityOk(col)) {
      classifyNullability({ tableName, col, expected, out });
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
    preservedExtras: [],
    retiredExtras: [],
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
  return out;
}
