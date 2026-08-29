import type {
  ColumnType,
  PackagePrefixedIndexName,
  ValidatedIdent,
} from './types';

export type CreateTableColumn = {
  readonly name: ValidatedIdent;
  readonly type: ColumnType;
  readonly isPrimaryKey: boolean;
  readonly physicalPostgres?: string;
  readonly physicalSqlite?: string;
  readonly generatedExpr?: string;
  readonly generatedStored?: boolean;
  readonly references?: {
    readonly table: ValidatedIdent;
    readonly column: ValidatedIdent;
  };
};

export type ServerOperation =
  | {
      readonly kind: 'create_table';
      readonly table: ValidatedIdent;
      readonly columns: readonly CreateTableColumn[];
    }
  | {
      readonly kind: 'add_column';
      readonly table: ValidatedIdent;
      readonly column: ValidatedIdent;
      readonly type: ColumnType;
      readonly physicalPostgres?: string;
      readonly physicalSqlite?: string;
    }
  | {
      readonly kind: 'backfill';
      readonly table: ValidatedIdent;
      readonly column: ValidatedIdent;
      /** SQL expression assigned where column IS NULL. */
      readonly expression: string;
    }
  | {
      readonly kind: 'create_index';
      readonly name: PackagePrefixedIndexName;
      readonly table: ValidatedIdent;
      readonly columns: readonly ValidatedIdent[];
      readonly unique: boolean;
    }
  | {
      readonly kind: 'drop_index';
      readonly name: PackagePrefixedIndexName;
    }
  | {
      readonly kind: 'add_check';
      readonly name: ValidatedIdent;
      readonly table: ValidatedIdent;
      readonly expression: string;
    }
  | {
      readonly kind: 'add_foreign_key';
      readonly name: ValidatedIdent;
      readonly table: ValidatedIdent;
      readonly column: ValidatedIdent;
      readonly refTable: ValidatedIdent;
      readonly refColumn: ValidatedIdent;
    }
  | {
      readonly kind: 'create_view';
      readonly name: ValidatedIdent;
      readonly expression: string;
    }
  | {
      readonly kind: 'replace_view';
      readonly name: ValidatedIdent;
      readonly expression: string;
    }
  | {
      readonly kind: 'create_enum';
      readonly name: ValidatedIdent;
      readonly values: readonly string[];
      readonly nativePostgres: boolean;
    }
  | {
      readonly kind: 'add_enum_value';
      readonly name: ValidatedIdent;
      readonly value: string;
    };

export type ClientOperation =
  | ServerOperation
  | {
      readonly kind: 'drop_table';
      readonly table: ValidatedIdent;
    }
  | {
      readonly kind: 'drop_column';
      readonly table: ValidatedIdent;
      readonly column: ValidatedIdent;
    }
  | {
      readonly kind: 'rebuild_table';
      readonly table: ValidatedIdent;
      /** Non-managed `_`-prefixed columns to preserve across rebuild. */
      readonly preserveUnderscoreExtras: readonly ValidatedIdent[];
      /** Physical SQLite types for extras (from introspection). */
      readonly preserveExtraTypes: Readonly<Record<string, string>>;
      /** Columns present on the old table that should be copied into the new one. */
      readonly copyColumns: readonly ValidatedIdent[];
      /** Optional rename map: newCol → oldCol for copy during rebuild. */
      readonly copyAliases?: Readonly<Record<string, string>>;
    }
  | {
      readonly kind: 'drop_view';
      readonly name: ValidatedIdent;
    };

export type PlanServerResult =
  | { readonly ok: true; readonly operations: readonly ServerOperation[] }
  | {
      readonly ok: false;
      readonly drift: readonly import('./types').DriftError[];
    };

export type PlanClientResult =
  | { readonly ok: true; readonly operations: readonly ClientOperation[] }
  | {
      readonly ok: false;
      readonly drift: readonly import('./types').DriftError[];
    };

export const SERVER_OPERATION_KINDS = [
  'create_table',
  'add_column',
  'backfill',
  'create_index',
  'drop_index',
  'add_check',
  'add_foreign_key',
  'create_view',
  'replace_view',
  'create_enum',
  'add_enum_value',
] as const satisfies readonly ServerOperation['kind'][];

export const CLIENT_EXTRA_OPERATION_KINDS = [
  'drop_table',
  'drop_column',
  'rebuild_table',
  'drop_view',
] as const;
