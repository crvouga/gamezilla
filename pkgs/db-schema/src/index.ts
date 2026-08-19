export type {
  DefineSchemaOptions,
  TableNamePolicy,
} from './core/define-schema';
export type {
  TableDef,
  TableDefInput,
  TableDefSlice,
} from './core/define-table';
export { defineTable } from './core/define-table';
export { domainsFromTables, registerTables } from './core/register-tables';
export type { ColumnType, Schema, Snapshot } from './core/types';
