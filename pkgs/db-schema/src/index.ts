export type { ColumnSpecInput } from './core/column-spec';
export {
  type DefineSchemaOptions,
  type TableNamePolicy,
} from './core/define-schema';
export type {
  TableDef,
  TableDefInput,
  TableDefSlice,
} from './core/define-table';
export { defineTable } from './core/define-table';
export type { DialectCaps } from './core/dialect-caps';
export { POSTGRES_CAPS, SQLITE_CAPS } from './core/dialect-caps';
export type { DialectSql } from './core/dialect-sql';
export { indexFingerprintName } from './core/index-fingerprint';
export { assertProductSchema } from './core/product-schema';
export {
  domainsFromTables,
  type RegisterTablesOptions,
  registerTables,
} from './core/register-tables';
export type {
  SchemaRule,
  SchemaViolation,
} from './core/schema-evolution';
export { assertEvolvable, diffSnapshots } from './core/schema-evolution';
export type {
  BackfillSpec,
  ColumnType,
  DeclaredColumn,
  IndexDef,
  ManagedImplicitColumn,
  RetiredColumn,
  RetiredTable,
  Schema,
  Snapshot,
} from './core/types';
export {
  COLUMN_TYPES,
  MANAGED_IMPLICIT_COLUMN_NAMES,
  MANAGED_IMPLICIT_COLUMNS,
  PRODUCT_COLUMN_TYPES,
} from './core/types';
