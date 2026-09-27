import type { DialectSql } from './dialect-sql';

/**
 * Closed column type token set. Tokens are DDL mapping contracts between
 * Postgres and SQLite — not TypeScript value types.
 *
 * Product domain tables are restricted to {@link PRODUCT_COLUMN_TYPES} (the
 * original six) by `assertProductSchema`; infra schemas may use every token.
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

export const PRODUCT_COLUMN_TYPE_SET: ReadonlySet<string> = new Set(
  PRODUCT_COLUMN_TYPES
);

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

/** Declared schema identifier (snake_case + length + keyword checks). */
export type SchemaIdent = string & {
  readonly __brand: 'SchemaIdent';
};

/** Catalog / rebuild identifier (may include `_`-prefixed physical extras). */
export type PhysicalIdent = string & {
  readonly __brand: 'PhysicalIdent';
};

/** Package-owned index name (`ix_<table>_<hash>`). */
export type PackagePrefixedIndexName = string & {
  readonly __brand: 'PackagePrefixedIndexName';
};

export type BackfillSpec =
  | { readonly from: string }
  | { readonly sql: DialectSql };

/**
 * Declared column with lifecycle metadata.
 * Snapshot still projects only {@link ColumnType} for wire stability.
 */
export type DeclaredColumn = {
  readonly type: ColumnType;
  readonly renamedFrom?: string;
  readonly widenedFrom?: string;
  readonly backfill?: BackfillSpec;
  /** Physical override for Postgres (still participates in drift). */
  readonly physicalPostgres?: string;
  /** Physical override for SQLite. */
  readonly physicalSqlite?: string;
};

export type DeclaredTable = Readonly<Record<string, DeclaredColumn>>;

export type DeclaredTables = Readonly<Record<string, DeclaredTable>>;

/**
 * A column removed from `columns` whose frozen shape old clients still read.
 * The server must keep the column present with exactly this logical type
 * forever; the client may drop it on a row-preserving rebuild.
 */
export type RetiredColumn = {
  readonly name: string;
  readonly type: ColumnType;
  readonly note: string;
};

/**
 * A table removed from the schema whose existence old clients still depend on.
 * The server must keep the table present; undeclared tables are never dropped.
 */
export type RetiredTable = {
  readonly domain: string;
  readonly name: string;
  readonly note: string;
};

/** `[table, ...columns]` */
export type IndexDef = readonly [string, ...string[]];

export type Snapshot = {
  readonly tables: {
    readonly [table: string]: { readonly [column: string]: ColumnType };
  };
  readonly retiredColumns: {
    readonly [table: string]: {
      readonly [column: string]: {
        readonly type: ColumnType;
        readonly note: string;
      };
    };
  };
  /**
   * Declared engine-specific type overrides, projected so the evolution gate
   * can flag a newly narrowed column. Absent keys mean no override.
   */
  readonly physicalOverrides: {
    readonly [table: string]: {
      readonly [column: string]: {
        readonly postgres?: string;
        readonly sqlite?: string;
      };
    };
  };
  readonly retiredTables: readonly {
    readonly name: string;
    readonly note: string;
  }[];
  readonly indexes: readonly IndexDef[];
  readonly uniqueIndexes: readonly IndexDef[];
};

/**
 * Internal declared schema shape drivers and planners consume.
 * Not part of the public root export surface.
 */
export type ReadonlyDeclaredSchema = {
  readonly tables: DeclaredTables;
  readonly indexes: readonly IndexDef[];
  readonly uniqueIndexes: readonly IndexDef[];
  /** `"<table>.<column>"` → tombstone. */
  readonly retiredColumns: ReadonlyMap<string, RetiredColumn>;
  /** table name → tombstone. */
  readonly retiredTables: ReadonlyMap<string, RetiredTable>;
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
  /**
   * Physical engine type used for drift comparison. Postgres: canonical
   * `udt_name` (`bigint`, `int4`, `varchar`, …). SQLite: STRICT affinity.
   */
  readonly physical: string;
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
  /** Engine reports the index as not usable (Postgres `indisvalid = false`). */
  readonly invalid?: boolean;
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
