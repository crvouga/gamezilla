import type { DialectSql } from './dialect-sql';

/**
 * Closed column type token set. Tokens are DDL mapping contracts between
 * Postgres and SQLite — not TypeScript value types.
 *
 * Product domain tables should keep the original six
 * (`uuid|text|integer|boolean|timestamp|json`) until sync cell-codec is
 * proven for the rest. New tokens are legal in this package and its tests.
 */
export type ColumnType =
  | 'uuid'
  | 'text'
  | 'integer'
  | 'boolean'
  | 'timestamp'
  | 'json'
  | 'real'
  | 'blob'
  | 'numeric'
  | 'date';

export const COLUMN_TYPES: readonly ColumnType[] = [
  'uuid',
  'text',
  'integer',
  'boolean',
  'timestamp',
  'json',
  'real',
  'blob',
  'numeric',
  'date',
] as const;

export const COLUMN_TYPE_SET: ReadonlySet<string> = new Set(COLUMN_TYPES);

/** Original six tokens used by product domain tables / sync wire. */
export const PRODUCT_COLUMN_TYPES: readonly ColumnType[] = [
  'uuid',
  'text',
  'integer',
  'boolean',
  'timestamp',
  'json',
] as const;

/** Engine-owned implicit columns created on every table. */
export const MANAGED_IMPLICIT_COLUMNS = {
  id: 'text',
  created_at: 'timestamp',
  updated_at: 'timestamp',
  deleted_at: 'timestamp',
} as const satisfies Record<string, ColumnType>;

export type ManagedImplicitColumn = keyof typeof MANAGED_IMPLICIT_COLUMNS;

export const MANAGED_IMPLICIT_COLUMN_NAMES: readonly ManagedImplicitColumn[] = [
  'id',
  'created_at',
  'updated_at',
  'deleted_at',
];

export const MANAGED_IMPLICIT_SET: ReadonlySet<string> = new Set(
  MANAGED_IMPLICIT_COLUMN_NAMES
);

/** Branded identifier that has passed snake_case + length validation. */
export type ValidatedIdent = string & {
  readonly __brand: 'ValidatedIdent';
};

/** Package-owned index name (`ix_<table>_<hash>`). */
export type PackagePrefixedIndexName = string & {
  readonly __brand: 'PackagePrefixedIndexName';
};

export type BackfillSpec =
  | { readonly from: string }
  | { readonly sql: DialectSql };

export type ForeignKeyRef = {
  readonly table: string;
  readonly column: string;
};

export type GeneratedSpec = {
  readonly expr: DialectSql;
  readonly stored: boolean;
};

/**
 * Declared column with lifecycle + portable-object metadata.
 * Snapshot still projects only {@link ColumnType} for wire stability.
 */
export type DeclaredColumn = {
  readonly type: ColumnType;
  readonly renamedFrom?: string;
  readonly widenedFrom?: string;
  readonly backfill?: BackfillSpec;
  readonly references?: ForeignKeyRef;
  readonly generated?: GeneratedSpec;
  /** Physical override for Postgres (still participates in drift). */
  readonly physicalPostgres?: string;
  /** Physical override for SQLite. */
  readonly physicalSqlite?: string;
  /** Named enum type reference (portable TEXT+CHECK by default). */
  readonly enumName?: string;
  /** Array of a logical scalar type (Postgres native; SQLite JSON TEXT). */
  readonly arrayOf?: ColumnType;
};

export type DeclaredTable = Readonly<Record<string, DeclaredColumn>>;

export type DeclaredTables = Readonly<Record<string, DeclaredTable>>;

/** `[table, ...columns]` */
export type IndexDef = readonly [string, ...string[]];

/** `[table, note]` or `[table, column, note]` */
export type DeprecationDef =
  | readonly [string, string]
  | readonly [string, string, string];

export type CheckDef = {
  readonly name: string;
  readonly table: string;
  readonly sql: DialectSql;
};

export type DeclaredView = {
  readonly domain: string;
  readonly name: string;
  readonly sql: DialectSql;
};

export type DeclaredEnum = {
  readonly domain: string;
  readonly name: string;
  readonly values: readonly string[];
  /** When true and dialect supports it, use CREATE TYPE AS ENUM. */
  readonly nativePostgres?: boolean;
};

export type Snapshot = {
  readonly tables: {
    readonly [table: string]: { readonly [column: string]: ColumnType };
  };
  readonly indexes: readonly IndexDef[];
  readonly uniqueIndexes: readonly IndexDef[];
  readonly deprecations: readonly DeprecationDef[];
  readonly checks: readonly CheckDef[];
  readonly views: readonly DeclaredView[];
  readonly enums: readonly DeclaredEnum[];
};

/**
 * Internal declared schema shape drivers and planners consume.
 * Not part of the public root export surface.
 */
export type ReadonlyDeclaredSchema = {
  readonly tables: DeclaredTables;
  readonly indexes: readonly IndexDef[];
  readonly uniqueIndexes: readonly IndexDef[];
  readonly deprecations: readonly DeprecationDef[];
  readonly checks: readonly CheckDef[];
  readonly views: readonly DeclaredView[];
  readonly enums: readonly DeclaredEnum[];
  /** Tables that appear in a 2-tuple deprecation. */
  readonly deprecatedTables: ReadonlySet<string>;
  /** `table.column` keys for 3-tuple deprecations. */
  readonly deprecatedColumns: ReadonlySet<string>;
  /** Deprecated view names. */
  readonly deprecatedViews: ReadonlySet<string>;
  /** Deprecated enum names. */
  readonly deprecatedEnums: ReadonlySet<string>;
};

export type Schema = {
  readonly snapshot: () => Snapshot;
  /** @internal package-only */
  readonly _declared: ReadonlyDeclaredSchema;
};

/** Physical SQLite STRICT type (logical tokens collapse here). */
export type SqlitePhysicalType = 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB';

export type IntrospectedColumn = {
  readonly name: string;
  /** Logical token when known (Postgres); physical for SQLite. */
  readonly type: ColumnType | SqlitePhysicalType | string;
  readonly nullable: boolean;
  readonly isPrimaryKey: boolean;
};

export type IntrospectedTable = {
  readonly name: string;
  readonly columns: readonly IntrospectedColumn[];
};

export type IntrospectedIndex = {
  readonly name: string;
  readonly table: string;
  readonly columns: readonly string[];
};

export type IntrospectedCheck = {
  readonly name: string;
  readonly table: string;
};

export type IntrospectedForeignKey = {
  readonly name: string;
  readonly table: string;
  readonly column: string;
  readonly refTable: string;
  readonly refColumn: string;
};

export type IntrospectedView = {
  readonly name: string;
};

export type IntrospectedEnum = {
  readonly name: string;
  readonly values: readonly string[];
};

export type IntrospectedCatalog = {
  readonly tables: ReadonlyMap<string, IntrospectedTable>;
  /** Package-prefixed indexes only matter for planning drops; others listed for completeness. */
  readonly indexes: readonly IntrospectedIndex[];
  /** All table names in scope (PG: schema; SQLite: whole DB). */
  readonly allTableNames: ReadonlySet<string>;
  readonly checks?: readonly IntrospectedCheck[];
  readonly foreignKeys?: readonly IntrospectedForeignKey[];
  readonly views?: readonly IntrospectedView[];
  readonly enums?: readonly IntrospectedEnum[];
};

export type DriftError = {
  readonly path: string;
  readonly message: string;
};

/** Project DeclaredColumn map to ColumnType map (snapshot / helpers). */
export function columnTypesOf(
  table: DeclaredTable
): Record<string, ColumnType> {
  const out: Record<string, ColumnType> = {};
  for (const [name, col] of Object.entries(table)) {
    out[name] = col.type;
  }
  return out;
}

export function simpleColumn(type: ColumnType): DeclaredColumn {
  return { type };
}
