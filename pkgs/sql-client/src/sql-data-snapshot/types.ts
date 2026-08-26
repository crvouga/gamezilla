/**
 * Portable logical table dump — engine-agnostic JSON rows.
 * Schema always comes from migrate / existing DB; dumps are data-only.
 */

export const SQL_DATA_DUMP_VERSION = 1 as const;

/** JSON-canonical cell for portable dumps. */
export type SqlDumpValue =
  | null
  | boolean
  | number
  | string
  | readonly SqlDumpValue[]
  | { readonly [key: string]: SqlDumpValue };

export type SqlTableDump = {
  readonly columns: readonly string[];
  readonly rows: readonly (readonly SqlDumpValue[])[];
};

/** Data-only dump. Schema always comes from migrate / existing DB. */
export type SqlDataDump = {
  readonly version: typeof SQL_DATA_DUMP_VERSION;
  readonly tables: Readonly<Record<string, SqlTableDump>>;
};

export type SqlDataDumpOptions = {
  readonly tables?: readonly string[];
};
