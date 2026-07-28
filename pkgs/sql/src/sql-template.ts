/**
 * Tiger Style: nested parameterized SQL fragments. Invariants are asserted
 * (crash on misuse); placeholders are bounded; strings/values stay paired.
 */
import { assert } from '@pkgs/assert';

/**
 * Values supported by SQL engine.
 */
export type Value =
  | Record<string, unknown>
  | Array<unknown>
  | Date
  | string
  | number
  | boolean
  | null
  | undefined;

/**
 * Supported value or SQL instance.
 */
export type RawValue = Value | Sql;

/** Default separator between joined bound values / bulk rows. */
export const DEFAULT_LIST_SEPARATOR = ',';

/** Default text before the first joined term. */
export const DEFAULT_LIST_PREFIX = '';

/** Default text after the last joined term. */
export const DEFAULT_LIST_SUFFIX = '';

/** Opens each bulk VALUES row. */
export const BULK_ROW_OPEN = '(';

/** Closes each bulk VALUES row. */
export const BULK_ROW_CLOSE = ')';

/**
 * Upper bound on flattened bound parameters (SQLite default
 * SQLITE_MAX_VARIABLE_NUMBER).
 */
export const MAX_BOUND_VALUES = 32766;

assert.ok(
  MAX_BOUND_VALUES >= 1,
  'Tiger: MAX_BOUND_VALUES must allow at least one bound value'
);

type FlattenedSql = {
  readonly strings: string[];
  readonly values: Value[];
};

function assertIndexInBounds(
  index: number,
  length: number,
  label: string
): void {
  assert.ok(index >= 0, `Sql: negative index (${label})`, { index, length });
  assert.ok(index < length, `Sql: index out of bounds (${label})`, {
    index,
    length,
  });
}

function atString(
  arr: readonly string[],
  index: number,
  label: string
): string {
  assertIndexInBounds(index, arr.length, label);
  return arr[index]!;
}

function atValue(arr: readonly Value[], index: number, label: string): Value {
  assertIndexInBounds(index, arr.length, label);
  // Value may be `undefined`; bounds check is the slot invariant.
  return arr[index] as Value;
}

function atRawValue(
  arr: readonly RawValue[],
  index: number,
  label: string
): RawValue {
  assertIndexInBounds(index, arr.length, label);
  // RawValue may be `undefined`; bounds check is the slot invariant.
  return arr[index] as RawValue;
}

function countFlattenedValues(rawValues: readonly RawValue[]): number {
  let len = 0;
  for (const value of rawValues) {
    if (value instanceof Sql) {
      len += value.values.length;
    } else {
      len += 1;
    }
  }
  assert.ok(len >= 0, 'Sql: flattened value count must be non-negative', {
    len,
  });
  assert.ok(
    len <= MAX_BOUND_VALUES,
    'Sql: flattened value count exceeds MAX_BOUND_VALUES',
    { len, max: MAX_BOUND_VALUES }
  );
  return len;
}

function appendNestedSql(
  result: { strings: string[]; values: Value[] },
  pos: number,
  child: Sql,
  rawString: string
): number {
  assert.ok(pos < result.strings.length, 'Sql: nest write past strings end', {
    pos,
    stringsLength: result.strings.length,
  });
  assert.equals(
    child.strings.length,
    child.values.length + 1,
    'Sql: nested fragment strings/values invariant broken',
    { stringsLength: child.strings.length, valuesLength: child.values.length }
  );

  result.strings[pos] =
    atString(result.strings, pos, 'nest-prefix') +
    atString(child.strings, 0, 'child-prefix');

  let childIndex = 0;
  while (childIndex < child.values.length) {
    result.values[pos++] = atValue(child.values, childIndex++, 'child-value');
    result.strings[pos] = atString(child.strings, childIndex, 'child-string');
  }

  result.strings[pos] =
    atString(result.strings, pos, 'nest-suffix') + rawString;
  return pos;
}

function assertStringsValuesPair(
  strings: readonly string[],
  values: readonly Value[],
  label: string
): void {
  assert.ok(strings.length >= 1, `Sql: ${label} needs at least one string`, {
    stringsLength: strings.length,
  });
  assert.equals(
    strings.length,
    values.length + 1,
    `Sql: ${label} strings/values length mismatch`,
    { stringsLength: strings.length, valuesLength: values.length }
  );
}

function flattenSql(
  rawStrings: readonly string[],
  rawValues: readonly RawValue[]
): FlattenedSql {
  assert.ok(rawStrings.length >= 1, 'Sql: expected at least 1 string', {
    rawStringsLength: rawStrings.length,
    rawValuesLength: rawValues.length,
  });
  assert.equals(
    rawStrings.length,
    rawValues.length + 1,
    `Sql: expected ${rawStrings.length} strings to have ${rawStrings.length - 1} values`,
    {
      rawStringsLength: rawStrings.length,
      rawValuesLength: rawValues.length,
    }
  );

  const valuesLength = countFlattenedValues(rawValues);
  const values = new Array<Value>(valuesLength);
  const strings = new Array<string>(valuesLength + 1);
  strings[0] = atString(rawStrings, 0, 'raw-prefix');

  let i = 0;
  let pos = 0;
  const result = { strings, values };
  while (i < rawValues.length) {
    const child = atRawValue(rawValues, i++, 'raw-value');
    const rawString = atString(rawStrings, i, 'raw-string');
    if (child instanceof Sql) {
      pos = appendNestedSql(result, pos, child, rawString);
    } else {
      values[pos++] = child;
      strings[pos] = rawString;
    }
  }

  assertStringsValuesPair(strings, values, 'flattened');
  return { strings, values };
}

function joinPlaceholders(
  strings: readonly string[],
  format: (index: number) => string
): string {
  assert.ok(strings.length >= 1, 'Sql: joinPlaceholders needs strings', {
    stringsLength: strings.length,
  });
  const len = strings.length;
  let i = 1;
  let value = atString(strings, 0, 'placeholder-prefix');
  while (i < len) {
    value += `${format(i)}${atString(strings, i, 'placeholder-part')}`;
    i++;
  }
  return value;
}

function listGlueStrings(
  termCount: number,
  separator: string,
  prefix: string,
  suffix: string
): string[] {
  assert.ok(termCount >= 1, 'Sql: list needs at least one term', { termCount });
  return [prefix, ...Array(termCount - 1).fill(separator), suffix];
}

/**
 * A SQL instance can be nested within each other to build SQL strings.
 */
export class Sql {
  readonly values: Value[];
  readonly strings: string[];

  constructor(rawStrings: readonly string[], rawValues: readonly RawValue[]) {
    const flattened = flattenSql(rawStrings, rawValues);
    assertStringsValuesPair(flattened.strings, flattened.values, 'constructed');
    this.values = flattened.values;
    this.strings = flattened.strings;
  }

  get sql() {
    return joinPlaceholders(this.strings, () => '?');
  }

  get statement() {
    return joinPlaceholders(this.strings, (i) => `:${i}`);
  }

  get text() {
    return joinPlaceholders(this.strings, (i) => `$${i}`);
  }

  inspect() {
    return {
      sql: this.sql,
      statement: this.statement,
      text: this.text,
      values: this.values,
    };
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return this.inspect();
  }
}

/**
 * Create a SQL query for a list of values.
 */
export function join(
  values: readonly RawValue[],
  separator = DEFAULT_LIST_SEPARATOR,
  prefix = DEFAULT_LIST_PREFIX,
  suffix = DEFAULT_LIST_SUFFIX
) {
  assert.ok(
    values.length > 0,
    'Sql: join([]) expected a non-empty array of elements',
    { length: values.length }
  );
  assert.ok(
    values.length <= MAX_BOUND_VALUES,
    'Sql: join term count exceeds MAX_BOUND_VALUES',
    { length: values.length, max: MAX_BOUND_VALUES }
  );

  return new Sql(
    listGlueStrings(values.length, separator, prefix, suffix),
    values
  );
}

/**
 * Create a SQL query for a list of structured values.
 */
export function bulk(
  data: ReadonlyArray<ReadonlyArray<RawValue>>,
  separator = DEFAULT_LIST_SEPARATOR,
  prefix = DEFAULT_LIST_PREFIX,
  suffix = DEFAULT_LIST_SUFFIX
) {
  assert.ok(data.length > 0, 'Sql: bulk([]) expected a non-empty nested array', {
    rowCount: data.length,
  });

  const first = atRawRow(data, 0);
  const columnCount = first.length;
  assert.ok(
    columnCount > 0,
    'Sql: bulk([[]]) expected nested arrays of multiple elements',
    { columnCount }
  );

  const rows = data.map((item, index) => {
    assert.equals(
      item.length,
      columnCount,
      `Sql: bulk([${index}][]) column count mismatch`,
      { index, actual: item.length, expected: columnCount }
    );
    return new Sql(
      listGlueStrings(item.length, separator, BULK_ROW_OPEN, BULK_ROW_CLOSE),
      item
    );
  });

  return new Sql(
    listGlueStrings(rows.length, separator, prefix, suffix),
    rows
  );
}

function atRawRow(
  data: ReadonlyArray<ReadonlyArray<RawValue>>,
  index: number
): readonly RawValue[] {
  const row = data[index];
  assert.ok(row !== undefined, 'Sql: bulk missing row', {
    index,
    rowCount: data.length,
  });
  return row;
}

/**
 * Create raw SQL statement.
 */
export function raw(value: string) {
  assert.string(value, 'Sql: raw() expects a string', { value });
  return new Sql([value], []);
}

/**
 * Placeholder value for "no text".
 */
export const empty = raw('');

assert.equals(empty.values.length, 0, 'Tiger: empty must bind no values', {
  valuesLength: empty.values.length,
});
assert.equals(empty.strings.length, 1, 'Tiger: empty must be a single string', {
  stringsLength: empty.strings.length,
});
assert.equals(empty.strings[0], '', 'Tiger: empty string must be ""', {
  strings: empty.strings,
});

/**
 * Create a SQL object from a template string.
 */
export default function sql(
  strings: readonly string[],
  ...values: readonly RawValue[]
) {
  return new Sql(strings, values);
}

export { sql };
