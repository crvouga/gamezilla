/**
 * Tiger Style (see the repo `README.md`): attribute tags for the sync entity store — keys validated
 * via {@link @pkgs/keyword}; never accept silently malformed attribute keys.
 *
 * Every attribute declares an explicit {@link DataType} so the SQL / wire
 * layer downstream (sync entity store) can reason about the storage shape (index
 * picking, CAST emission, validation, etc.) without re-deriving it from the
 * parser. The TypeScript value type produced by the parser is constrained to
 * match the declared data type, with paired `*OrNull` variants for the
 * nullable case.
 */
import { assert } from '@pkgs/assert';
import {
  assertLocalName,
  assertNamespacedKeyword,
  type JoinDot,
  joinKeywordSegments,
  type Keyword,
  namespacePrefixOf,
} from '@pkgs/keyword/keyword';

export type { JoinDot, Keyword };

/** Flat state bag keyed by full attribute keys (`prefix/name`). */
export type AttributeState = Record<Keyword, unknown>;

/**
 * Declared storage shape of an attribute's value. The TypeScript value type
 * a tag produces is derived from this via {@link DataTypeValue}.
 *
 * - `text`: any UTF-8 string.
 * - `uuid`: string formatted as a UUID (parser is responsible for validating).
 * - `enum`: string from a closed set known at tag construction time.
 * - `date`: ISO-8601 calendar date (`YYYY-MM-DD`).
 * - `timestamp`: ISO-8601 instant (`YYYY-MM-DDTHH:MM:SS[.sss]Z`).
 * - `time`: ISO-8601 time-of-day (`HH:MM:SS`).
 * - `email`: RFC 5322-ish email string.
 * - `url`: absolute URL string.
 * - `integer`: safe integer (`Number.isSafeInteger`).
 * - `number`: finite JS number (`Number.isFinite`); use `integer` when the
 *   value never has a fractional part.
 * - `bigint`: JS `bigint`.
 * - `boolean`: JS `boolean`.
 * - `binary`: `Uint8Array`.
 * - `json`: plain object (`Record<string, unknown>`); use `array` for arrays.
 * - `array`: ordered list (`readonly E[]`).
 *
 * Parsers MUST produce values matching the declared shape (the TS signature
 * enforces this at compile time). The runtime does not re-validate parser
 * output; that is the parser's contract.
 */
export type DataType =
  | 'text'
  | 'uuid'
  | 'enum'
  | 'date'
  | 'timestamp'
  | 'time'
  | 'email'
  | 'url'
  | 'integer'
  | 'number'
  | 'bigint'
  | 'boolean'
  | 'binary'
  | 'json'
  | 'array';

/**
 * Maps {@link DataType} → the base TypeScript value type a non-nullable tag of
 * that data type produces.
 */
export type DataTypeValue<D extends DataType> = D extends
  | 'text'
  | 'uuid'
  | 'enum'
  | 'date'
  | 'timestamp'
  | 'time'
  | 'email'
  | 'url'
  ? string
  : D extends 'integer' | 'number'
    ? number
    : D extends 'bigint'
      ? bigint
      : D extends 'boolean'
        ? boolean
        : D extends 'binary'
          ? Uint8Array
          : D extends 'json'
            ? Record<string, unknown>
            : D extends 'array'
              ? readonly unknown[]
              : never;

/**
 * Parse and validate a raw stored value into `T`. May throw if invalid.
 */
export type AttributeParser<T> = (value: unknown) => T;

/**
 * Index intent attached to an {@link AttributeTag} via {@link AttributeTag.indexed}.
 * Storage / query engines use this to decide whether a covering generated
 * column + native btree should exist for the tag. Engines forbid indexing
 * `json`, `array`, and `binary` data types (no sane scalar column form).
 */
export type AttributeIndexSpec = {
  /** `true` when the engine should support ORDER BY on this attribute. */
  readonly sortable: boolean;
  /** `true` when the value is unique within its entity type's partition. */
  readonly unique: boolean;
};

export interface AttributeTag<
  T = unknown,
  K extends string = string,
  D extends DataType = DataType,
  Nullable extends boolean = boolean,
> {
  readonly key: K & Keyword;
  /** Declared storage shape (see {@link DataType}). */
  readonly dataType: D;
  /**
   * `true` when the parser may produce `null` (in addition to {@link DataType}
   * values). Sync entity store / SQL emitters use this to decide whether a column
   * may take SQL `NULL`.
   */
  readonly nullable: Nullable;
  /**
   * For `dataType === 'enum'` only: the closed set of allowed string values
   * declared at construction time. Empty tuple for all other data types.
   */
  readonly enumValues: readonly string[];
  /**
   * Index intent (see {@link AttributeIndexSpec}). `null` for tags that do
   * not opt into a covering generated column / index. Set via the fluent
   * {@link AttributeTag.indexed} method.
   */
  readonly index: AttributeIndexSpec | null;
  readonly parse: AttributeParser<T>;
  /**
   * Builds a single-key patch `{ [key]: parse(value) }` for entity store writes.
   * Use {@link AttributeTag.parse} to validate raw input without wrapping.
   */
  (value: unknown): { readonly [P in K & Keyword]: T };
  /** Reads `state[key]` then parses (missing key yields `undefined`). */
  from(state: AttributeState): T;
  /**
   * Returns a tag with the same identity / parser / data type, but marked
   * with an {@link AttributeIndexSpec}. Engines downstream (sync entity store)
   * use this to provision a typed generated column + native btree so range
   * / equality / ORDER BY queries hit the index instead of casting JSON TEXT.
   *
   * Calling {@link indexed} on a `json`, `array`, or `binary` tag crashes —
   * those data types have no scalar column form.
   *
   * Idempotent: subsequent calls overwrite the spec, never accumulate.
   */
  indexed(opts?: {
    readonly sortable?: boolean;
    readonly unique?: boolean;
  }): AttributeTag<T, K, D, Nullable>;
}

/** Generic / unbranded view used by sync entity store indexes, UI hooks, etc. */
export type AnyAttributeTag<T = unknown> = AttributeTag<
  T,
  string,
  DataType,
  boolean
>;

/** Convenience: tag built off a {@link AttributeNamespace} prefix + name. */
export type NamespacedKey<
  Prefix extends string,
  Name extends string,
> = `${Prefix}/${Name}`;

type TagOpts = {
  dataType: DataType;
  nullable: boolean;
  enumValues?: readonly string[];
  index?: AttributeIndexSpec | null;
};

/**
 * Data types for which {@link AttributeTag.indexed} would have no scalar
 * column form on Postgres. Indexing these crashes at the call site instead
 * of failing silently during schema reconciliation.
 */
const UN_INDEXABLE_DATA_TYPES: ReadonlySet<DataType> = new Set<DataType>([
  'json',
  'array',
  'binary',
]);

function normalizeIndexSpec(
  opts: { sortable?: boolean; unique?: boolean } | undefined
): AttributeIndexSpec {
  return Object.freeze({
    sortable: opts?.sortable === true,
    unique: opts?.unique === true,
  });
}

function defineReadonly<T extends object>(
  target: T,
  name: string,
  value: unknown
): void {
  Object.defineProperty(target, name, {
    value,
    enumerable: false,
    configurable: false,
    writable: false,
  });
}

function createAttributeTag<
  T,
  K extends string,
  D extends DataType,
  N extends boolean,
>(
  fullKey: K,
  parse: AttributeParser<T>,
  opts: TagOpts & { dataType: D; nullable: N }
): AttributeTag<T, K, D, N> {
  assert.nonEmptyString(fullKey, 'Tiger: attribute tag key must be non-empty');
  assert.ok(
    typeof parse === 'function',
    'Tiger: attribute parser must be a function'
  );
  assertNamespacedKeyword(assert, fullKey);

  const brandedKey = fullKey as K & Keyword;
  const enumValues = Object.freeze([...(opts.enumValues ?? [])]);
  const index: AttributeIndexSpec | null = opts.index ?? null;

  function attr(value: unknown): { readonly [P in K & Keyword]: T } {
    return { [fullKey]: parse(value) } as { readonly [P in K & Keyword]: T };
  }
  defineReadonly(attr, 'key', brandedKey);
  defineReadonly(attr, 'dataType', opts.dataType);
  defineReadonly(attr, 'nullable', opts.nullable);
  defineReadonly(attr, 'enumValues', enumValues);
  defineReadonly(attr, 'index', index);
  defineReadonly(attr, 'parse', parse);
  (attr as { from?: (state: AttributeState) => T }).from = (
    state: AttributeState
  ): T => parse(state[fullKey]);
  (
    attr as {
      indexed?: (opts?: {
        sortable?: boolean;
        unique?: boolean;
      }) => AttributeTag<T, K, D, N>;
    }
  ).indexed = (indexOpts?: {
    sortable?: boolean;
    unique?: boolean;
  }): AttributeTag<T, K, D, N> => {
    assert.ok(
      !UN_INDEXABLE_DATA_TYPES.has(opts.dataType),
      'Tiger: indexed() not allowed on json/array/binary tags (no scalar column form)',
      { key: fullKey, dataType: opts.dataType }
    );
    return createAttributeTag(fullKey, parse, {
      ...opts,
      index: normalizeIndexSpec(indexOpts),
    });
  };
  return attr as AttributeTag<T, K, D, N>;
}

/**
 * Namespace bound to a kebab-namespaced keyword prefix. Each per-type method
 * returns an {@link AttributeTag} whose value type is constrained to the
 * declared {@link DataType}. The `*OrNull` variants allow the parser to also
 * produce `null` (mapped to SQL `NULL` downstream).
 */
export interface AttributeNamespace<Prefix extends string = string> {
  readonly prefix: Prefix;
  /** True when `key` is a full keyword whose namespace prefix equals this namespace's `prefix`. */
  ownsKey(key: string): boolean;

  text<const Name extends string, T extends string = string>(
    name: Name,
    parse: AttributeParser<T>
  ): AttributeTag<T, NamespacedKey<Prefix, Name>, 'text', false>;

  textOrNull<const Name extends string, T extends string = string>(
    name: Name,
    parse: AttributeParser<T | null>
  ): AttributeTag<T | null, NamespacedKey<Prefix, Name>, 'text', true>;

  uuid<const Name extends string>(
    name: Name,
    parse: AttributeParser<string>
  ): AttributeTag<string, NamespacedKey<Prefix, Name>, 'uuid', false>;

  uuidOrNull<const Name extends string>(
    name: Name,
    parse: AttributeParser<string | null>
  ): AttributeTag<string | null, NamespacedKey<Prefix, Name>, 'uuid', true>;

  /**
   * Enum attribute. `values` is the closed set of allowed strings; the parser
   * must produce one of them. When `parse` is omitted, a default parser is
   * synthesised that returns the input verbatim if it appears in `values`,
   * else `values[0]` (the declared default).
   */
  enum<
    const Name extends string,
    const V extends readonly [string, ...string[]],
  >(
    name: Name,
    values: V,
    parse?: AttributeParser<V[number]>
  ): AttributeTag<V[number], NamespacedKey<Prefix, Name>, 'enum', false>;

  enumOrNull<
    const Name extends string,
    const V extends readonly [string, ...string[]],
  >(
    name: Name,
    values: V,
    parse?: AttributeParser<V[number] | null>
  ): AttributeTag<V[number] | null, NamespacedKey<Prefix, Name>, 'enum', true>;

  date<const Name extends string>(
    name: Name,
    parse: AttributeParser<string>
  ): AttributeTag<string, NamespacedKey<Prefix, Name>, 'date', false>;

  dateOrNull<const Name extends string>(
    name: Name,
    parse: AttributeParser<string | null>
  ): AttributeTag<string | null, NamespacedKey<Prefix, Name>, 'date', true>;

  timestamp<const Name extends string>(
    name: Name,
    parse: AttributeParser<string>
  ): AttributeTag<string, NamespacedKey<Prefix, Name>, 'timestamp', false>;

  timestampOrNull<const Name extends string>(
    name: Name,
    parse: AttributeParser<string | null>
  ): AttributeTag<
    string | null,
    NamespacedKey<Prefix, Name>,
    'timestamp',
    true
  >;

  time<const Name extends string>(
    name: Name,
    parse: AttributeParser<string>
  ): AttributeTag<string, NamespacedKey<Prefix, Name>, 'time', false>;

  timeOrNull<const Name extends string>(
    name: Name,
    parse: AttributeParser<string | null>
  ): AttributeTag<string | null, NamespacedKey<Prefix, Name>, 'time', true>;

  email<const Name extends string>(
    name: Name,
    parse: AttributeParser<string>
  ): AttributeTag<string, NamespacedKey<Prefix, Name>, 'email', false>;

  emailOrNull<const Name extends string>(
    name: Name,
    parse: AttributeParser<string | null>
  ): AttributeTag<string | null, NamespacedKey<Prefix, Name>, 'email', true>;

  url<const Name extends string>(
    name: Name,
    parse: AttributeParser<string>
  ): AttributeTag<string, NamespacedKey<Prefix, Name>, 'url', false>;

  urlOrNull<const Name extends string>(
    name: Name,
    parse: AttributeParser<string | null>
  ): AttributeTag<string | null, NamespacedKey<Prefix, Name>, 'url', true>;

  integer<const Name extends string, T extends number = number>(
    name: Name,
    parse: AttributeParser<T>
  ): AttributeTag<T, NamespacedKey<Prefix, Name>, 'integer', false>;

  integerOrNull<const Name extends string, T extends number = number>(
    name: Name,
    parse: AttributeParser<T | null>
  ): AttributeTag<T | null, NamespacedKey<Prefix, Name>, 'integer', true>;

  number<const Name extends string, T extends number = number>(
    name: Name,
    parse: AttributeParser<T>
  ): AttributeTag<T, NamespacedKey<Prefix, Name>, 'number', false>;

  numberOrNull<const Name extends string, T extends number = number>(
    name: Name,
    parse: AttributeParser<T | null>
  ): AttributeTag<T | null, NamespacedKey<Prefix, Name>, 'number', true>;

  bigint<const Name extends string>(
    name: Name,
    parse: AttributeParser<bigint>
  ): AttributeTag<bigint, NamespacedKey<Prefix, Name>, 'bigint', false>;

  bigintOrNull<const Name extends string>(
    name: Name,
    parse: AttributeParser<bigint | null>
  ): AttributeTag<bigint | null, NamespacedKey<Prefix, Name>, 'bigint', true>;

  boolean<const Name extends string>(
    name: Name,
    parse: AttributeParser<boolean>
  ): AttributeTag<boolean, NamespacedKey<Prefix, Name>, 'boolean', false>;

  booleanOrNull<const Name extends string>(
    name: Name,
    parse: AttributeParser<boolean | null>
  ): AttributeTag<boolean | null, NamespacedKey<Prefix, Name>, 'boolean', true>;

  binary<const Name extends string>(
    name: Name,
    parse: AttributeParser<Uint8Array>
  ): AttributeTag<Uint8Array, NamespacedKey<Prefix, Name>, 'binary', false>;

  binaryOrNull<const Name extends string>(
    name: Name,
    parse: AttributeParser<Uint8Array | null>
  ): AttributeTag<
    Uint8Array | null,
    NamespacedKey<Prefix, Name>,
    'binary',
    true
  >;

  json<
    const Name extends string,
    T extends Record<string, unknown> = Record<string, unknown>,
  >(
    name: Name,
    parse: AttributeParser<T>
  ): AttributeTag<T, NamespacedKey<Prefix, Name>, 'json', false>;

  jsonOrNull<
    const Name extends string,
    T extends Record<string, unknown> = Record<string, unknown>,
  >(
    name: Name,
    parse: AttributeParser<T | null>
  ): AttributeTag<T | null, NamespacedKey<Prefix, Name>, 'json', true>;

  array<
    const Name extends string,
    T extends readonly unknown[] = readonly unknown[],
  >(
    name: Name,
    parse: AttributeParser<T>
  ): AttributeTag<T, NamespacedKey<Prefix, Name>, 'array', false>;

  arrayOrNull<
    const Name extends string,
    T extends readonly unknown[] = readonly unknown[],
  >(
    name: Name,
    parse: AttributeParser<T | null>
  ): AttributeTag<T | null, NamespacedKey<Prefix, Name>, 'array', true>;
}

function defaultEnumParser<V extends readonly [string, ...string[]]>(
  values: V
): AttributeParser<V[number]> {
  const allowed = new Set<string>(values);
  const fallback = values[0];
  return (v: unknown): V[number] => {
    if (typeof v === 'string' && allowed.has(v)) return v as V[number];
    return fallback;
  };
}

function defaultEnumOrNullParser<V extends readonly [string, ...string[]]>(
  values: V
): AttributeParser<V[number] | null> {
  const allowed = new Set<string>(values);
  return (v: unknown): V[number] | null => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'string' && allowed.has(v)) return v as V[number];
    return null;
  };
}

function assertEnumValues(values: readonly string[]): void {
  assert.array(values, 'enum values must be an array');
  assert.ok(values.length > 0, 'enum values must be non-empty');
  for (const v of values) {
    assert.nonEmptyString(v, 'enum value must be a non-empty string', {
      value: v,
    });
  }
}

function fullKeyFor<Prefix extends string, Name extends string>(
  prefix: Prefix,
  name: Name
): NamespacedKey<Prefix, Name> {
  assertLocalName(assert, name);
  const fullKey = `${prefix}/${name}` as NamespacedKey<Prefix, Name>;
  assertNamespacedKeyword(assert, fullKey);
  return fullKey;
}

/**
 * Returns a `bind(name, parse) → AttributeTag` factory bound to one
 * `(dataType, nullable)` pair. Used to mass-produce the per-type namespace
 * methods (`text`, `boolean`, `integerOrNull`, …) with shared validation.
 */
function makeSimple<
  Prefix extends string,
  D extends DataType,
  N extends boolean,
>(prefix: Prefix, dataType: D, nullable: N) {
  return function bind<Name extends string, T>(
    name: Name,
    parse: AttributeParser<T>
  ): AttributeTag<T, NamespacedKey<Prefix, Name>, D, N> {
    return createAttributeTag(fullKeyFor(prefix, name), parse, {
      dataType,
      nullable,
      enumValues: [],
    });
  };
}

function makeEnum<Prefix extends string>(prefix: Prefix) {
  return function bind<
    Name extends string,
    V extends readonly [string, ...string[]],
  >(
    name: Name,
    values: V,
    parse?: AttributeParser<V[number]>
  ): AttributeTag<V[number], NamespacedKey<Prefix, Name>, 'enum', false> {
    assertEnumValues(values);
    return createAttributeTag(
      fullKeyFor(prefix, name),
      parse ?? defaultEnumParser(values),
      { dataType: 'enum', nullable: false, enumValues: values }
    );
  };
}

function makeEnumOrNull<Prefix extends string>(prefix: Prefix) {
  return function bind<
    Name extends string,
    V extends readonly [string, ...string[]],
  >(
    name: Name,
    values: V,
    parse?: AttributeParser<V[number] | null>
  ): AttributeTag<V[number] | null, NamespacedKey<Prefix, Name>, 'enum', true> {
    assertEnumValues(values);
    return createAttributeTag(
      fullKeyFor(prefix, name),
      parse ?? defaultEnumOrNullParser(values),
      { dataType: 'enum', nullable: true, enumValues: values }
    );
  };
}

function buildNamespace<Prefix extends string>(
  prefix: Prefix
): AttributeNamespace<Prefix> {
  return {
    prefix,
    ownsKey(key: string): boolean {
      const p = namespacePrefixOf(key);
      return p !== null && p === prefix;
    },
    text: makeSimple(prefix, 'text', false),
    textOrNull: makeSimple(prefix, 'text', true),
    uuid: makeSimple(prefix, 'uuid', false),
    uuidOrNull: makeSimple(prefix, 'uuid', true),
    enum: makeEnum(prefix),
    enumOrNull: makeEnumOrNull(prefix),
    date: makeSimple(prefix, 'date', false),
    dateOrNull: makeSimple(prefix, 'date', true),
    timestamp: makeSimple(prefix, 'timestamp', false),
    timestampOrNull: makeSimple(prefix, 'timestamp', true),
    time: makeSimple(prefix, 'time', false),
    timeOrNull: makeSimple(prefix, 'time', true),
    email: makeSimple(prefix, 'email', false),
    emailOrNull: makeSimple(prefix, 'email', true),
    url: makeSimple(prefix, 'url', false),
    urlOrNull: makeSimple(prefix, 'url', true),
    integer: makeSimple(prefix, 'integer', false),
    integerOrNull: makeSimple(prefix, 'integer', true),
    number: makeSimple(prefix, 'number', false),
    numberOrNull: makeSimple(prefix, 'number', true),
    bigint: makeSimple(prefix, 'bigint', false),
    bigintOrNull: makeSimple(prefix, 'bigint', true),
    boolean: makeSimple(prefix, 'boolean', false),
    booleanOrNull: makeSimple(prefix, 'boolean', true),
    binary: makeSimple(prefix, 'binary', false),
    binaryOrNull: makeSimple(prefix, 'binary', true),
    json: makeSimple(prefix, 'json', false),
    jsonOrNull: makeSimple(prefix, 'json', true),
    array: makeSimple(prefix, 'array', false),
    arrayOrNull: makeSimple(prefix, 'array', true),
  };
}

/**
 * Creates a namespace for attribute keys: `{prefix}/{name}` where `prefix` is
 * `segment0.segment1...` from the given kebab-case segments.
 */
export function createAttrNamespace<const Segments extends readonly string[]>(
  ...segments: Segments
): AttributeNamespace<JoinDot<Segments>> {
  assert.ok(
    segments.length > 0,
    'createAttrNamespace requires at least one namespace segment'
  );
  const prefix = joinKeywordSegments(...segments) as JoinDot<Segments>;
  return buildNamespace(prefix);
}
