import type {
  ColumnType,
  PackagePrefixedIndexName,
  ValidatedIdent,
} from './types';

export type CreateTableColumn = {
  readonly name: ValidatedIdent;
  readonly type: ColumnType;
  readonly isPrimaryKey: boolean;
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
    };

export type PlanServerResult =
  | { readonly ok: true; readonly operations: readonly ServerOperation[] }
  | {
      readonly ok: false;
      readonly drift: readonly import('./types').DriftError[];
    };
