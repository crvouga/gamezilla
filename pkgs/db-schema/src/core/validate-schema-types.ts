import type { AssertSnakeCase } from './snake-case';
import type { ColumnType, ManagedImplicitColumn } from './types';

type ErrorBrand<M extends string> = { readonly __error: M };

type IsColumnSpecObject<V> = V extends {
  readonly type: ColumnType;
}
  ? true
  : false;

type ValidateColMap<Cols, Table extends string> = {
  readonly [K in keyof Cols]: K extends string
    ? K extends ManagedImplicitColumn
      ? ErrorBrand<`tables.${Table}.${K}: engine-owned (implicit on every table)`>
      : AssertSnakeCase<K> extends K
        ? Cols[K] extends ColumnType
          ? Cols[K]
          : IsColumnSpecObject<Cols[K]> extends true
            ? Cols[K]
            : ErrorBrand<`tables.${Table}.${K}: invalid column type`>
        : AssertSnakeCase<K>
    : never;
};

type ValidateTablesMap<Tables> = {
  readonly [K in keyof Tables]: K extends string
    ? AssertSnakeCase<K> extends K
      ? Tables[K] extends Record<string, unknown>
        ? ValidateColMap<Tables[K], K>
        : ErrorBrand<`tables.${K}: columns must be an object`>
      : AssertSnakeCase<K>
    : never;
};

type HasError<T> = T extends { readonly __error: string } ? true : false;

type DeepHasError<T> = true extends {
  [K in keyof T]-?: HasError<T[K]> extends true
    ? true
    : T[K] extends Record<string, unknown>
      ? DeepHasError<T[K]>
      : false;
}[keyof T]
  ? true
  : false;

type FirstError<T> = {
  [K in keyof T]: HasError<T[K]> extends true
    ? T[K]
    : T[K] extends Record<string, unknown>
      ? FirstError<T[K]>
      : never;
}[keyof T];

type TableNames<T> = T extends { readonly tables: infer Tables }
  ? Extract<keyof Tables, string>
  : never;

type DeclaredColumnNames<T, Table extends string> = T extends {
  readonly tables: infer Tables;
}
  ? Tables extends Record<string, unknown>
    ? Table extends keyof Tables
      ? Tables[Table] extends Record<string, unknown>
        ? Extract<keyof Tables[Table], string>
        : never
      : never
    : never
  : never;

/** Declared columns plus engine-owned managed columns (for index validation). */
type ColumnNames<T, Table extends string> =
  | DeclaredColumnNames<T, Table>
  | ManagedImplicitColumn;

type ValidateIndexCol<
  T,
  Table extends string,
  Col extends string,
  Path extends string,
  Rest extends readonly string[],
> = Col extends 'id'
  ? ErrorBrand<`${Path}: cannot index primary key 'id' (already unique via PK)`>
  : Col extends ColumnNames<T, Table>
    ? Rest extends readonly string[]
      ? ValidateIndexRest<T, Table, Rest, Path>
      : unknown
    : ErrorBrand<`${Path}: unknown column '${Col}' on table '${Table}'`>;

type ValidateIndexEntry<T, Idx, Path extends string> = Idx extends readonly [
  infer Table extends string,
  infer Col extends string,
  ...infer Rest,
]
  ? Table extends TableNames<T>
    ? ValidateIndexCol<
        T,
        Table,
        Col,
        Path,
        Rest extends readonly string[] ? Rest : []
      >
    : ErrorBrand<`${Path}: unknown table '${Table}'`>
  : ErrorBrand<`${Path}: index must be [table, ...columns]`>;

type ValidateIndexRest<
  T,
  Table extends string,
  Rest extends readonly string[],
  Path extends string,
> = Rest extends readonly [infer C extends string, ...infer R extends string[]]
  ? C extends 'id'
    ? ErrorBrand<`${Path}: cannot index primary key 'id' (already unique via PK)`>
    : C extends ColumnNames<T, Table>
      ? ValidateIndexRest<T, Table, R, Path>
      : ErrorBrand<`${Path}: unknown column '${C}' on table '${Table}'`>
  : unknown;

type ValidateIndexesArr<T> = T extends {
  readonly indexes: infer Indexes extends readonly unknown[];
}
  ? {
      [I in keyof Indexes]: ValidateIndexEntry<
        T,
        Indexes[I],
        `indexes[${I & string}]`
      >;
    }[number]
  : unknown;

type ValidateUniqueIndexesArr<T> = T extends {
  readonly uniqueIndexes: infer Indexes extends readonly unknown[];
}
  ? {
      [I in keyof Indexes]: ValidateIndexEntry<
        T,
        Indexes[I],
        `uniqueIndexes[${I & string}]`
      >;
    }[number]
  : unknown;

/** A retired column must not still be declared in the same table. */
type ValidateRetiredEntry<
  T,
  Table extends string,
  Retired,
  Path extends string,
> = Retired extends { readonly name: infer Name extends string }
  ? Table extends TableNames<T>
    ? Name extends DeclaredColumnNames<T, Table>
      ? ErrorBrand<`${Path}: column '${Table}.${Name}' is still declared — remove it from columns and keep only the retiredColumns entry`>
      : unknown
    : ErrorBrand<`${Path}: unknown table '${Table}'`>
  : ErrorBrand<`${Path}: retired column must be { name, type, note }`>;

type ValidateRetiredColumnsMap<T> = T extends {
  readonly retiredColumns: infer Retired extends Record<
    string,
    readonly unknown[]
  >;
}
  ? {
      [Table in keyof Retired & string]: {
        [I in keyof Retired[Table]]: ValidateRetiredEntry<
          T,
          Table,
          Retired[Table][I],
          `retiredColumns.${Table}[${I & string}]`
        >;
      }[number];
    }[keyof Retired & string]
  : unknown;

type UnknownKeys<T> = Exclude<
  keyof T & string,
  'tables' | 'indexes' | 'uniqueIndexes' | 'retiredColumns' | 'retiredTables'
>;

/**
 * Validates a schema literal. Success → `T`. Failure → branded `{ __error }`.
 */
export type ValidateSchema<T> = [UnknownKeys<T>] extends [never]
  ? T extends { readonly tables: infer Tables }
    ? DeepHasError<ValidateTablesMap<Tables>> extends true
      ? Extract<
          FirstError<ValidateTablesMap<Tables>>,
          { readonly __error: string }
        >
      : ValidateIndexesArr<T> extends infer Ix
        ? Ix extends { readonly __error: string }
          ? Ix
          : ValidateUniqueIndexesArr<T> extends infer Ux
            ? Ux extends { readonly __error: string }
              ? Ux
              : ValidateRetiredColumnsMap<T> extends infer Ret
                ? Ret extends { readonly __error: string }
                  ? Ret
                  : T
                : T
            : T
        : T
    : ErrorBrand<'schema must include a tables object'>
  : ErrorBrand<`unknown top-level key '${UnknownKeys<T>}'`>;

/**
 * Parameter type that preserves const inference: valid literals keep `T`,
 * invalid ones surface the branded error.
 */
export type SchemaInput<T> = [ValidateSchema<T>] extends [T]
  ? T
  : ValidateSchema<T>;

export type SchemaLiteral = {
  readonly tables: Record<string, Record<string, string | { type: string }>>;
  readonly indexes?: readonly (readonly [string, ...string[]])[];
  readonly uniqueIndexes?: readonly (readonly [string, ...string[]])[];
  readonly retiredColumns?: Record<
    string,
    readonly {
      readonly name: string;
      readonly type: string;
      readonly note: string;
    }[]
  >;
  readonly retiredTables?: readonly {
    readonly domain: string;
    readonly name: string;
    readonly note: string;
  }[];
};
