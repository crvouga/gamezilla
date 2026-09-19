import type {
  ColumnType,
  DriftError,
  PackagePrefixedIndexName,
  PhysicalIdent,
  SchemaIdent,
} from './types';

export type CreateTableColumn = {
  readonly name: SchemaIdent;
  readonly type: ColumnType;
  readonly isPrimaryKey: boolean;
  readonly physicalPostgres?: string;
  readonly physicalSqlite?: string;
};

export type ServerOperation =
  | {
      readonly kind: 'create_table';
      readonly table: SchemaIdent;
      readonly columns: readonly CreateTableColumn[];
    }
  | {
      readonly kind: 'add_column';
      readonly table: SchemaIdent;
      readonly column: SchemaIdent;
      readonly type: ColumnType;
      readonly physicalPostgres?: string;
      readonly physicalSqlite?: string;
    }
  | {
      readonly kind: 'backfill';
      readonly table: SchemaIdent;
      readonly column: SchemaIdent;
      /** SQL expression assigned where column IS NULL. */
      readonly expression: string;
    }
  | {
      readonly kind: 'create_index';
      readonly name: PackagePrefixedIndexName;
      readonly table: SchemaIdent;
      readonly columns: readonly SchemaIdent[];
      readonly unique: boolean;
    }
  | {
      readonly kind: 'drop_index';
      readonly name: PackagePrefixedIndexName;
    };

export type ClientOperation =
  | ServerOperation
  | {
      readonly kind: 'drop_table';
      readonly table: SchemaIdent;
    }
  | {
      readonly kind: 'rebuild_table';
      readonly table: SchemaIdent;
      /** Undeclared columns preserved across the rebuild (name → physical type). */
      readonly preserveExtras: Readonly<Record<string, string>>;
      /** Columns copied from the old table into the new one. */
      readonly copyColumns: readonly (SchemaIdent | PhysicalIdent)[];
      /** Optional rename map: newCol → oldCol for copy during rebuild. */
      readonly copyAliases?: Readonly<Record<string, string>>;
      /** Backfill expressions for new columns after rebuild (column → expr). */
      readonly backfills?: Readonly<Record<string, string>>;
    };

export type PlanServerResult =
  | { readonly ok: true; readonly operations: readonly ServerOperation[] }
  | {
      readonly ok: false;
      readonly drift: readonly DriftError[];
    };

export type PlanClientResult =
  | { readonly ok: true; readonly operations: readonly ClientOperation[] }
  | {
      readonly ok: false;
      readonly drift: readonly DriftError[];
    };

export const SERVER_OPERATION_KINDS = [
  'create_table',
  'add_column',
  'backfill',
  'create_index',
  'drop_index',
] as const satisfies readonly ServerOperation['kind'][];

export const CLIENT_EXTRA_OPERATION_KINDS = [
  'drop_table',
  'rebuild_table',
] as const satisfies readonly Exclude<
  ClientOperation['kind'],
  ServerOperation['kind']
>[];
