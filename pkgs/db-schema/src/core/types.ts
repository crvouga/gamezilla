/**
 * Closed column type token set. Tokens are DDL mapping contracts between
 * Postgres and SQLite — not TypeScript value types.
 */
export type ColumnType =
  | 'uuid'
  | 'text'
  | 'integer'
  | 'boolean'
  | 'timestamp'
  | 'json';

export const COLUMN_TYPES: readonly ColumnType[] = [
  'uuid',
  'text',
  'integer',
  'boolean',
  'timestamp',
  'json',
] as const;

export const COLUMN_TYPE_SET: ReadonlySet<string> = new Set(COLUMN_TYPES);

/** Engine-owned implicit columns created on every table. */
export const MANAGED_IMPLICIT_COLUMNS = {
  _id: 'uuid',
  _created_at: 'timestamp',
  _updated_at: 'timestamp',
  _deleted_at: 'timestamp',
} as const satisfies Record<string, ColumnType>;

export type ManagedImplicitColumn = keyof typeof MANAGED_IMPLICIT_COLUMNS;

export const MANAGED_IMPLICIT_COLUMN_NAMES: readonly ManagedImplicitColumn[] = [
  '_id',
  '_created_at',
  '_updated_at',
  '_deleted_at',
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

export type DeclaredTable = Readonly<Record<string, ColumnType>>;

export type DeclaredTables = Readonly<Record<string, DeclaredTable>>;

/** `[table, ...columns]` */
export type IndexDef = readonly [string, ...string[]];

/** `[table, note]` or `[table, column, note]` */
export type DeprecationDef =
  | readonly [string, string]
  | readonly [string, string, string];

export type Snapshot = {
  readonly tables: {
    readonly [table: string]: { readonly [column: string]: ColumnType };
  };
  readonly indexes: readonly IndexDef[];
  readonly uniqueIndexes: readonly IndexDef[];
  readonly deprecations: readonly DeprecationDef[];
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
  /** Tables that appear in a 2-tuple deprecation. */
  readonly deprecatedTables: ReadonlySet<string>;
  /** `table.column` keys for 3-tuple deprecations. */
  readonly deprecatedColumns: ReadonlySet<string>;
};

export type Schema = {
  readonly snapshot: () => Snapshot;
  /** @internal package-only */
  readonly _declared: ReadonlyDeclaredSchema;
};

/** Physical SQLite STRICT type (logical tokens collapse here). */
export type SqlitePhysicalType = 'TEXT' | 'INTEGER';

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

export type IntrospectedCatalog = {
  readonly tables: ReadonlyMap<string, IntrospectedTable>;
  /** Package-prefixed indexes only matter for planning drops; others listed for completeness. */
  readonly indexes: readonly IntrospectedIndex[];
  /** All table names in scope (PG: schema; SQLite: whole DB). */
  readonly allTableNames: ReadonlySet<string>;
};

export type DriftError = {
  readonly path: string;
  readonly message: string;
};
